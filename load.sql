-- Replace the existing insider-trade snapshot with the current NDJSON export.
-- Run from the repository root with:
--   duckdb msft.duckdb < load.sql

BEGIN TRANSACTION;

DELETE FROM main.insiders;

INSERT INTO main.insiders (
  symbol,
  symbolName,
  fullName,
  shortJobTitle,
  transactionType,
  transactionDate,
  amount,
  reportedPrice,
  usdValue,
  eodHolding,
  eodHoldingPercentage,
  symbolCode,
  hasOptions,
  symbolType
)
SELECT
  symbol,
  symbolName,
  fullName,
  shortJobTitle,
  transactionType,
  transactionDate,
  amount,
  reportedPrice,
  usdValue,
  eodHolding,
  eodHoldingPercentage,
  symbolCode,
  hasOptions,
  symbolType
FROM read_ndjson(
  'barchart-insider-trades-MSFT-2026-09-21.ndjson',
  columns = {
    symbol: 'VARCHAR',
    symbolName: 'VARCHAR',
    fullName: 'VARCHAR',
    shortJobTitle: 'VARCHAR',
    transactionType: 'VARCHAR',
    transactionDate: 'DATE',
    amount: 'BIGINT',
    reportedPrice: 'DOUBLE',
    usdValue: 'BIGINT',
    eodHolding: 'BIGINT',
    eodHoldingPercentage: 'DOUBLE',
    symbolCode: 'VARCHAR',
    hasOptions: 'BOOLEAN',
    symbolType: 'BIGINT'
  },
  format = 'newline_delimited'
);

COMMIT;
