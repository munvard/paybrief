import pg from "pg";
const { Pool } = pg;
type Pool = InstanceType<typeof pg.Pool>;

export async function checkReproduction(
  pool: Pool,
  triggerChild: (parentId: string) => Promise<void>
) {
  const client = await pool.connect();
  try {
    const candidates = await client.query(
      `SELECT id FROM businesses
       WHERE status = 'alive'
         AND wallet_balance_cached >= 3.0
         AND call_count_cached >= 20
         AND (last_reproduced_at IS NULL OR last_reproduced_at < NOW() - INTERVAL '48 hours')
       LIMIT 5`
    );
    for (const r of candidates.rows) {
      await triggerChild(r.id);
      await client.query(`UPDATE businesses SET last_reproduced_at = NOW() WHERE id = $1`, [r.id]);
    }
  } finally {
    client.release();
  }
}
