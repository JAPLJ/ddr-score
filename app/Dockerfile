FROM rust:1.84.1-slim-bullseye AS builder
ARG API_BINARY

RUN USER=root cargo new --bin work
WORKDIR /work

RUN apt-get update && apt-get install -y pkg-config libssl-dev
COPY Cargo.toml Cargo.lock ./
RUN cargo build --release
RUN rm src/*.rs

COPY src ./src
COPY .sqlx ./.sqlx
RUN touch src/main.rs && cargo build --release --bin ${API_BINARY}
RUN strip /work/target/release/${API_BINARY} -o /app-bin

FROM gcr.io/distroless/cc
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.0 /lambda-adapter /opt/extensions/lambda-adapter
COPY --from=builder /app-bin /
EXPOSE 8080

CMD ["./app-bin"]
