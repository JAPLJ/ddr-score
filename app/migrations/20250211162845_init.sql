create table user (
    id integer not null primary key autoincrement,
    name text not null,
    password_hash text not null
);

create table song (
    id integer not null primary key autoincrement,
    name text not null,
    ver text not null
);
create index song_title on song(name);

create table chart (
    id integer not null primary key autoincrement,
    song int not null,
    play_type int not null,
    difficulty int not null,
    level int not null
);
create index chart_level on chart(level);

create table score (
    id integer not null primary key autoincrement,
    user int not null,
    chart int not null,
    score int,
    clear_rank text,
    clear_kind text,
    flare_rank int,
    flare_skill int,
    created_at text not null
);
create index score_index on score(chart);

create table best (
    id integer not null primary key autoincrement,
    user int not null,
    chart int not null,
    score int not null
);
create index best_user on best(user, chart);
