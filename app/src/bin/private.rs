use std::{collections::HashMap, time::Duration};

use anyhow::Result;
use app::ApiResult;
use axum::{extract::State, routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};

#[derive(Debug, Clone, Deserialize)]
struct AddUserRequest {
    user: String,
    password: String,
}

async fn add_user(
    State(pool): State<SqlitePool>,
    Json(req): Json<AddUserRequest>,
) -> ApiResult<()> {
    let hash = bcrypt::hash(&req.password, 8)?;

    sqlx::query!(
        r"insert into user (name, password_hash) values (?, ?)",
        req.user,
        hash
    )
    .execute(&pool)
    .await?;

    Ok(())
}

#[derive(Debug, Clone, Deserialize)]
struct RequestSongData {
    name: String,
    version: String,
    levels: [Option<i64>; 5],
}

#[derive(Debug, Clone, Deserialize)]
struct AddSongsRequest {
    songs: Vec<RequestSongData>,
}

#[derive(Debug, Clone, Serialize)]
struct AddSongsResponse {
    inserted_songs: usize,
    inserted_charts: usize,
    updated_charts: usize,
}

async fn add_songs(
    State(pool): State<SqlitePool>,
    Json(req): Json<AddSongsRequest>,
) -> ApiResult<Json<AddSongsResponse>> {
    let mut res = AddSongsResponse {
        inserted_songs: 0,
        inserted_charts: 0,
        updated_charts: 0,
    };

    let cur_songs = sqlx::query!("select id, name, ver from song")
        .fetch_all(&pool)
        .await?
        .into_iter()
        .map(|s| (s.name, s.id))
        .collect::<HashMap<_, _>>();
    let cur_charts = sqlx::query!("select id, song, difficulty, level from chart")
        .fetch_all(&pool)
        .await?
        .into_iter()
        .map(|c| ((c.song, c.difficulty), (c.id, c.level)))
        .collect::<HashMap<_, _>>();

    let mut tx = pool.begin().await?;

    for s in req.songs {
        let song_id = if let Some(id) = cur_songs.get(&s.name) {
            *id
        } else {
            let ss = sqlx::query!(
                "insert into song (name, ver) values (?, ?) returning id",
                s.name,
                s.version
            )
            .fetch_one(&mut *tx)
            .await?;
            res.inserted_songs += 1;
            ss.id
        };
        for dif in 0..5 {
            let Some(level) = s.levels[dif] else {
                continue;
            };
            let dif = dif as i64;
            if let Some(&(chart_id, cur_level)) = cur_charts.get(&(song_id, dif)) {
                if level == cur_level {
                    continue;
                }
                sqlx::query!("update chart set level = ? where id = ?", level, chart_id)
                    .execute(&mut *tx)
                    .await?;
                res.updated_charts += 1;
            } else {
                sqlx::query!(
                    "insert into chart (song, play_type, difficulty, level) values (?, 1, ?, ?)",
                    song_id,
                    dif,
                    level
                )
                .execute(&mut *tx)
                .await?;
                res.inserted_charts += 1;
            }
        }
    }

    tx.commit().await?;

    Ok(Json(res))
}

#[tokio::main]
async fn main() -> Result<()> {
    let db_url = std::env::var("DATABASE_URL").unwrap_or("sqlite:./.db/ddr_score.db".to_string());

    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(10))
        .idle_timeout(Duration::from_secs(1))
        .connect(&db_url)
        .await?;

    let app = Router::new()
        .route("/api/private/add_user", post(add_user))
        .route("/api/private/add_songs", post(add_songs))
        .with_state(pool);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    axum::serve(listener, app).await?;

    Ok(())
}
