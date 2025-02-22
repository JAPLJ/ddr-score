use std::{fmt::Display, str::FromStr};

use anyhow::anyhow;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};

#[derive(Debug, Clone, Copy)]
pub enum Difficulty {
    Beginner = 0,
    Basic = 1,
    Difficult = 2,
    Expert = 3,
    Challenge = 4,
}

impl FromStr for Difficulty {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_ascii_lowercase().as_str() {
            "beginner" => Ok(Self::Beginner),
            "basic" => Ok(Self::Basic),
            "difficult" => Ok(Self::Difficult),
            "expert" => Ok(Self::Expert),
            "challenge" => Ok(Self::Challenge),
            _ => Err(anyhow!("Unknown difficulty {}", s)),
        }
    }
}

impl Display for Difficulty {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Beginner => write!(f, "BEGINNER"),
            Self::Basic => write!(f, "BASIC"),
            Self::Difficult => write!(f, "DIFFICULT"),
            Self::Expert => write!(f, "EXPERT"),
            Self::Challenge => write!(f, "CHALLENGE"),
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum ClearRank {
    AAA = 0,
    AAPlus = 1,
    AA = 2,
    AAMinus = 3,
    APlus = 4,
    A = 5,
    AMinus = 6,
    BPlus = 7,
    B = 8,
    BMinus = 9,
    CPlus = 10,
    C = 11,
    CMinus = 12,
    DPlus = 13,
    D = 14,
    E = 15,
}

impl FromStr for ClearRank {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_ascii_uppercase().as_str() {
            "AAA" => Ok(Self::AAA),
            "AA+" => Ok(Self::AAPlus),
            "AA" => Ok(Self::AA),
            "AA-" => Ok(Self::AAMinus),
            "A+" => Ok(Self::APlus),
            "A" => Ok(Self::A),
            "A-" => Ok(Self::AMinus),
            "B+" => Ok(Self::BPlus),
            "B" => Ok(Self::B),
            "B-" => Ok(Self::BMinus),
            "C+" => Ok(Self::CPlus),
            "C" => Ok(Self::C),
            "C-" => Ok(Self::CMinus),
            "D+" => Ok(Self::DPlus),
            "D" => Ok(Self::D),
            "E" => Ok(Self::E),
            _ => Err(anyhow!("Unknown clear rank {}", s)),
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub enum ClearKind {
    MFC = 0,
    PFC = 1,
    GFC = 2,
    FC = 3,
    Life4 = 4,
    Clear = 5,
    Assisted = 6,
    Failed = 7,
    NoPlay = 8,
}

impl FromStr for ClearKind {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_ascii_uppercase().as_str() {
            "MFC" => Ok(Self::MFC),
            "PFC" => Ok(Self::PFC),
            "GFC" => Ok(Self::GFC),
            "FC" => Ok(Self::FC),
            "LIFE4" => Ok(Self::Life4),
            "CLEAR" => Ok(Self::Clear),
            "ASSISTED" => Ok(Self::Assisted),
            "FAILED" => Ok(Self::Failed),
            "NO PLAY" => Ok(Self::NoPlay),
            _ => Err(anyhow!("Unknown clear kind {}", s)),
        }
    }
}
pub struct ApiError(anyhow::Error);

pub type ApiResult<T, E = ApiError> = std::result::Result<T, E>;

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Something went wrong: {}", self.0),
        )
            .into_response()
    }
}

impl<E> From<E> for ApiError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        Self(err.into())
    }
}
