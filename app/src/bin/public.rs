use std::{
    collections::{HashMap, HashSet},
    time::Duration,
};

use anyhow::{anyhow, Result};
use app::{ApiResult, ClearKind, ClearRank, Difficulty};
use axum::{extract::State, http::Method, routing::post, Json, Router};
use chrono::Utc;
use flate2::{write::GzEncoder, Compression};
use serde::{Deserialize, Serialize};
use sqlx::{prelude::FromRow, sqlite::SqlitePoolOptions, QueryBuilder, Sqlite, SqlitePool};
use tower_http::cors::{self, CorsLayer};

async fn auth_user(
    pool: SqlitePool,
    name: impl AsRef<str>,
    password: impl AsRef<str>,
) -> Result<i64> {
    let name = name.as_ref();
    let password = password.as_ref();

    let user = sqlx::query!(r"select id, password_hash from user where name = ?", name)
        .fetch_one(&pool)
        .await?;

    if bcrypt::verify(password, &user.password_hash)? {
        Ok(user.id)
    } else {
        Err(anyhow!("User authentication failed"))
    }
}

#[derive(Debug, Clone, Deserialize)]
struct RequestScoreData {
    title: String,
    difficulty: String,
    score: Option<i64>,
    rank: Option<String>,
    clear_kind: Option<String>,
    flare_skill: Option<i64>,
    flare_rank: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
struct UpdateScoreRequest {
    user: String,
    password: String,
    scores: Vec<RequestScoreData>,
}

#[derive(Debug, Clone, Serialize)]
struct UpdateScoreResponse {
    updated: usize,
    errors: Vec<String>,
}

async fn update_score(
    State(pool): State<SqlitePool>,
    Json(req): Json<UpdateScoreRequest>,
) -> ApiResult<Json<UpdateScoreResponse>> {
    let mut res = UpdateScoreResponse {
        updated: 0,
        errors: vec![],
    };
    let user_id = auth_user(pool.clone(), req.user, req.password).await?;

    // 楽曲・譜面データ取得
    let songs = sqlx::query!(r"select * from song")
        .fetch_all(&pool)
        .await?
        .iter()
        .map(|r| (r.name.clone(), r.id))
        .collect::<HashMap<_, _>>();

    let charts = sqlx::query!(r"select id, song, difficulty from chart")
        .fetch_all(&pool)
        .await?
        .iter()
        .map(|r| ((r.song, r.difficulty), r.id))
        .collect::<HashMap<_, _>>();

    // 自己ベスト情報取得
    struct Best {
        id: i64,
        score: Option<i64>,
        rank: Option<String>,
        kind: Option<String>,
        flare: Option<i64>,
    }
    let cur_bests = sqlx::query!(
        r"select
            best.id,
            best.chart,
            bs.score,
            bs.clear_rank,
            bs.clear_kind,
            bs.flare_rank
        from
            best
        inner join score as bs on best.score = bs.id
        where
            best.user = ?",
        user_id
    )
    .fetch_all(&pool)
    .await?
    .iter()
    .map(|r| {
        (
            r.chart,
            Best {
                id: r.id,
                score: r.score,
                rank: r.clear_rank.clone(),
                kind: r.clear_kind.clone(),
                flare: r.flare_rank,
            },
        )
    })
    .collect::<HashMap<_, _>>();

    // 自己ベストを更新したものだけに絞る
    struct NewRecord {
        chart_id: i64,
        req_index: usize,
        best_id: Option<i64>,
    }
    let mut new_records = vec![];
    for (i, score) in req.scores.iter().enumerate() {
        let Ok(dif) = score.difficulty.parse::<Difficulty>() else {
            res.errors.push(format!(
                "[{}] Unknown difficulty: {}",
                score.title, score.difficulty
            ));
            continue;
        };

        let Some(chart_id) = songs
            .get(&score.title)
            .and_then(|s| charts.get(&(*s, dif as i64)))
        else {
            res.errors
                .push(format!("Unknown song/chart: {} ({})", score.title, dif));
            continue;
        };

        let (best_id, update) = if let Some(best) = cur_bests.get(&chart_id) {
            (
                Some(best.id),
                best.score.unwrap_or(-1) < score.score.unwrap_or(-1)
                    || {
                        let br = best
                            .rank
                            .as_ref()
                            .and_then(|r| r.parse::<ClearRank>().ok())
                            .map(|r| r as i64);
                        let nr = score
                            .rank
                            .as_ref()
                            .and_then(|r| r.parse::<ClearRank>().ok())
                            .map(|r| r as i64);
                        br.unwrap_or(i64::MAX) > nr.unwrap_or(i64::MAX)
                    }
                    || {
                        let bk = best
                            .kind
                            .as_ref()
                            .and_then(|k| k.parse::<ClearKind>().ok())
                            .map(|k| k as i64);
                        let nk = score
                            .clear_kind
                            .as_ref()
                            .and_then(|k| k.parse::<ClearKind>().ok())
                            .map(|k| k as i64);
                        bk.unwrap_or(i64::MAX) > nk.unwrap_or(i64::MAX)
                    }
                    || best.flare.unwrap_or(-1) < score.flare_rank.unwrap_or(-1),
            )
        } else {
            (
                None,
                score.score.is_some()
                    || score.rank.is_some()
                    || score.clear_kind.is_some()
                    || score.flare_skill.is_some(),
            )
        };

        if update {
            new_records.push(NewRecord {
                chart_id: *chart_id,
                req_index: i,
                best_id,
            });
        }
    }

    let mut tx = pool.begin().await?;

    // 新規スコア情報登録
    #[derive(FromRow)]
    struct NewRecordId {
        id: i64,
        chart: i64,
    }
    let mut new_records_ids = vec![];
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    const BIND_LIMIT: usize = 32766;
    for i in (0..new_records.len()).step_by(BIND_LIMIT / 8) {
        let mut qb: QueryBuilder<Sqlite> = QueryBuilder::new(
        "insert into score (user, chart, score, clear_rank, clear_kind, flare_rank, flare_skill, created_at) "
        );
        qb.push_values(
            &new_records[i..(i + BIND_LIMIT / 8).min(new_records.len())],
            |mut b, r| {
                let rq = &req.scores[r.req_index];
                b.push_bind(user_id)
                    .push_bind(r.chart_id)
                    .push_bind(rq.score)
                    .push_bind(&rq.rank)
                    .push_bind(&rq.clear_kind)
                    .push_bind(rq.flare_rank)
                    .push_bind(rq.flare_skill)
                    .push_bind(&now);
            },
        );
        qb.push(" returning id, chart");

        let query = qb.build_query_as::<NewRecordId>();
        new_records_ids.extend(query.fetch_all(&mut *tx).await?);
    }
    let new_records_ids = new_records_ids
        .into_iter()
        .map(|nr| (nr.chart, nr.id))
        .collect::<HashMap<_, _>>();

    // 自己ベスト登録・更新
    let mut new_bests_ids = vec![];
    for i in (0..new_records.len()).step_by(BIND_LIMIT / 3) {
        let mut qb: QueryBuilder<Sqlite> =
            QueryBuilder::new("insert into best (user, chart, score) ");
        qb.push_values(
            new_records[i..(i + BIND_LIMIT / 3).min(new_records.len())]
                .iter()
                .filter(|nr| nr.best_id.is_none()),
            |mut b, r| {
                b.push_bind(user_id)
                    .push_bind(r.chart_id)
                    .push_bind(new_records_ids.get(&r.chart_id).unwrap());
            },
        );
        qb.push(" returning id, chart");

        let query = qb.build_query_as::<NewRecordId>();
        new_bests_ids.extend(query.fetch_all(&mut *tx).await?);
    }
    let new_bests_ids = new_bests_ids
        .into_iter()
        .map(|nr| (nr.chart, nr.id))
        .collect::<HashMap<_, _>>();

    tx.commit().await?;

    sqlx::query!("pragma synchronous=0").execute(&pool).await?;
    let mut tx = pool.begin().await?;
    for nr in &new_records {
        let Some(best_id) = nr
            .best_id
            .or_else(|| new_bests_ids.get(&nr.chart_id).copied())
        else {
            continue;
        };
        if let Some(score_id) = new_records_ids.get(&nr.chart_id) {
            sqlx::query!(r"update best set score = ? where id = ?", score_id, best_id)
                .execute(&mut *tx)
                .await?;
        }
    }
    tx.commit().await?;
    sqlx::query!("pragma synchronous=2").execute(&pool).await?;

    res.updated = new_records.len();
    Ok(Json(res))
}

#[derive(Debug, Clone, Deserialize)]
struct DumpRequest {
    user: String,
    password: String,
}

async fn dump_user_data(
    State(pool): State<SqlitePool>,
    Json(req): Json<DumpRequest>,
) -> ApiResult<()> {
    let user_id = auth_user(pool.clone(), &req.user, &req.password).await?;

    let charts = sqlx::query!(
        r"select
            chart.id,
            song.name as title,
            difficulty,
            level
        from
            chart
        inner join song on song.id = chart.song"
    )
    .fetch_all(&pool)
    .await?
    .iter()
    .map(|r| (r.id, (r.title.to_string(), r.difficulty, r.level)))
    .collect::<HashMap<_, _>>();

    let mut bests_raw: Vec<u8> = vec![];
    {
        let mut w = csv::WriterBuilder::new()
            .delimiter(b'\t')
            .from_writer(GzEncoder::new(&mut bests_raw, Compression::new(6)));
        w.write_record(&[
            "id",
            "title",
            "difficulty",
            "level",
            "score",
            "clear_rank",
            "clear_kind",
            "flare_rank",
            "flare_skill",
        ])?;

        let bests = sqlx::query!(
            r"select
                chart.id,
                song.name as title,
                chart.difficulty,
                chart.level,
                bs.score,
                bs.clear_rank,
                bs.clear_kind,
                bs.flare_rank,
                bs.flare_skill
            from
                best
            inner join score as bs on bs.id = best.score
            inner join chart on chart.id = best.chart
            inner join song on song.id = chart.song
            where
                best.user = ?",
            user_id
        )
        .fetch_all(&pool)
        .await?;

        let unlocked = bests.iter().map(|r| r.id).collect::<HashSet<_>>();
        for b in bests {
            w.write_record(&[
                b.id.to_string(),
                b.title,
                b.difficulty.to_string(),
                b.level.to_string(),
                b.score.map_or("".to_owned(), |s| s.to_string()),
                b.clear_rank.unwrap_or("".to_owned()),
                b.clear_kind.unwrap_or("".to_owned()),
                b.flare_rank.map_or("".to_owned(), |f| f.to_string()),
                b.flare_skill.map_or("".to_owned(), |f| f.to_string()),
            ])?;
        }
        for c in &charts {
            let (&chart_id, (title, dif, level)) = c;
            if !unlocked.contains(&chart_id) {
                w.write_record(&[
                    chart_id.to_string(),
                    title.to_owned(),
                    dif.to_string(),
                    level.to_string(),
                    "".to_owned(),
                    "".to_owned(),
                    "LOCKED".to_owned(),
                    "".to_owned(),
                    "".to_owned(),
                ])?;
            }
        }
    }

    let mut scores_raw: Vec<u8> = vec![];
    {
        let mut w = csv::WriterBuilder::new()
            .delimiter(b'\t')
            .from_writer(GzEncoder::new(&mut scores_raw, Compression::new(6)));
        w.write_record(&[
            "id",
            "title",
            "difficulty",
            "level",
            "score",
            "clear_rank",
            "clear_kind",
            "flare_rank",
            "flare_skill",
            "updated_at",
        ])?;

        let scores = sqlx::query!(
            r"select
                chart,
                group_concat(ifnull(cast(score as text), '') order by created_at) as score,
                group_concat(ifnull(clear_rank, '') order by created_at) as clear_rank,
                group_concat(ifnull(clear_kind, '') order by created_at) as clear_kind,
                group_concat(ifnull(cast(flare_rank as text), '') order by created_at) as flare_rank,
                group_concat(ifnull(cast(flare_skill as text), '') order by created_at) as flare_skill,
                group_concat(created_at order by created_at) as updated_at
            from
                score
            where
                user = ?
            group by chart",
            user_id
        )
        .fetch_all(&pool)
        .await?;

        for s in scores {
            let Some((title, dif, level)) = charts.get(&s.chart) else {
                continue;
            };
            w.write_record(&[
                s.chart.to_string(),
                title.to_owned(),
                dif.to_string(),
                level.to_string(),
                s.score,
                s.clear_rank,
                s.clear_kind,
                s.flare_rank,
                s.flare_skill,
                s.updated_at,
            ])?;
        }
    }

    let config = aws_config::load_from_env().await;
    let client = aws_sdk_s3::Client::new(&config);
    let bucket = std::env::var("S3_BUCKET")?;

    client
        .put_object()
        .bucket(&bucket)
        .key(format!("scores/{}/data/bests.tsv.gz", req.user))
        .body(bests_raw.into())
        .send()
        .await?;
    client
        .put_object()
        .bucket(&bucket)
        .key(format!("scores/{}/data/scores.tsv.gz", req.user))
        .body(scores_raw.into())
        .send()
        .await?;

    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    let db_url = std::env::var("DATABASE_URL").unwrap_or("sqlite:./.db/ddr_score.db".to_string());

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(10))
        .connect(&db_url)
        .await?;

    let cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST])
        .allow_headers(cors::Any)
        .allow_origin(cors::Any);

    let app = Router::new()
        .route("/api/update_score", post(update_score))
        .route("/api/dump_user_data", post(dump_user_data))
        .layer(cors)
        .with_state(pool);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    axum::serve(listener, app).await.unwrap();

    Ok(())
}
