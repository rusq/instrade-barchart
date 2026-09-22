CREATE TABLE insiders (
    symbol VARCHAR,
    symbolName VARCHAR,
    fullName VARCHAR,
    shortJobTitle VARCHAR,
    transactionType VARCHAR,
    transactionDate DATE,
    amount BIGINT,
    reportedPrice DOUBLE,
    usdValue BIGINT,
    eodHolding BIGINT,
    eodHoldingPercentage DOUBLE,
    symbolCode VARCHAR,
    hasOptions BOOLEAN,
    symbolType BIGINT
);

CREATE VIEW current_holdings AS
SELECT DISTINCT
    fullName,
    last(eodHolding) OVER (
        PARTITION BY fullName
        ORDER BY transactionDate ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS curr
FROM insiders
ORDER BY fullName ASC, transactionDate DESC;

CREATE VIEW shares_per_month AS
WITH data_end AS (
    SELECT max(transactionDate) AS as_of_date
    FROM insiders
), compensation AS (
    SELECT
        i.fullName,
        (
            COALESCE(
                sum(i.amount) FILTER (
                    WHERE i.transactionType = 'Exercise'
                      AND i.transactionDate > (d.as_of_date - CAST('12 months' AS INTERVAL))
                      AND i.transactionDate <= d.as_of_date
                ),
                0
            ) / 12.0
        ) AS shares_per_mnth
    FROM insiders AS i, data_end AS d
    GROUP BY i.fullName
)
SELECT
    h.fullName AS "name",
    h.curr AS shares_remain,
    round(c.shares_per_mnth, 2) AS shares_per_mnth
FROM current_holdings AS h
INNER JOIN compensation AS c ON c.fullName = h.fullName
ORDER BY shares_per_mnth DESC;
