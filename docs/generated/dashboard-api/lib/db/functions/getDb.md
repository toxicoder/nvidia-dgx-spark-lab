[**dgx-lab-dashboard**](../../../README.md)

***

[dgx-lab-dashboard](../../../README.md) / [lib/db](../README.md) / getDb

# Function: getDb()

> **getDb**(): `BetterSQLite3Database`\<[`lib/db/schema`](../schema/README.md)\>

Defined in: [lib/db/index.ts:20](https://github.com/toxicoder/nvidia-dgx-spark-lab/blob/823225cb08462df45cc817777d78e62ac8c6a555/dashboard/lib/db/index.ts#L20)

Lazy Drizzle singleton with auto-migrate on first access (skipped when `USE_MOCKS=1`).
Container entrypoint runs `scripts/migrate.cjs` first; this is a safety net for dev.

## Returns

`BetterSQLite3Database`\<[`lib/db/schema`](../schema/README.md)\>
