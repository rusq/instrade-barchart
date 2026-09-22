"""Load a Barchart insider-trade NDJSON export into DuckDB."""

from __future__ import annotations

import argparse
from pathlib import Path

import duckdb


COLUMNS = {
    "symbol": "VARCHAR",
    "symbolName": "VARCHAR",
    "fullName": "VARCHAR",
    "shortJobTitle": "VARCHAR",
    "transactionType": "VARCHAR",
    "transactionDate": "DATE",
    "amount": "BIGINT",
    "reportedPrice": "DOUBLE",
    "usdValue": "BIGINT",
    "eodHolding": "BIGINT",
    "eodHoldingPercentage": "DOUBLE",
    "symbolCode": "VARCHAR",
    "hasOptions": "BOOLEAN",
    "symbolType": "BIGINT",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Replace the insiders table with a Barchart NDJSON export."
    )
    parser.add_argument(
        "input",
        type=Path,
        help="path to the newline-delimited JSON export",
    )
    parser.add_argument(
        "--database",
        type=Path,
        default=Path("msft.duckdb"),
        help="DuckDB database path (default: msft.duckdb)",
    )
    return parser.parse_args()


def ensure_schema(connection: duckdb.DuckDBPyConnection) -> None:
    exists = connection.execute(
        """
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'main'
          AND table_name = 'insiders'
          AND table_type = 'BASE TABLE'
        """
    ).fetchone()
    if exists is None:
        schema_path = Path(__file__).with_name("initialise.sql")
        connection.execute(schema_path.read_text(encoding="utf-8"))


def load_data(database: Path, input_path: Path) -> int:
    if not input_path.is_file():
        raise FileNotFoundError(f"input file does not exist: {input_path}")

    database.parent.mkdir(parents=True, exist_ok=True)
    connection = duckdb.connect(str(database))
    try:
        ensure_schema(connection)
        columns = ", ".join(f"{name}: '{kind}'" for name, kind in COLUMNS.items())
        connection.execute("BEGIN TRANSACTION")
        try:
            connection.execute("DELETE FROM main.insiders")
            connection.execute(
                f"""
                INSERT INTO main.insiders ({', '.join(COLUMNS)})
                SELECT {', '.join(COLUMNS)}
                FROM read_ndjson(
                    ?,
                    columns = {{{columns}}},
                    format = 'newline_delimited'
                )
                """,
                [str(input_path.resolve())],
            )
            row_count = connection.execute(
                "SELECT count(*) FROM main.insiders"
            ).fetchone()[0]
            connection.execute("COMMIT")
        except Exception:
            connection.execute("ROLLBACK")
            raise
    finally:
        connection.close()
    return row_count


def main() -> None:
    args = parse_args()
    row_count = load_data(args.database, args.input)
    print(f"Loaded {row_count:,} rows from {args.input} into {args.database}.")


if __name__ == "__main__":
    main()
