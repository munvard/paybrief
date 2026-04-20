import pg from "pg";
const { Pool } = pg;
type Pool = InstanceType<typeof pg.Pool>;

export async function runDeathClock(
  pool: Pool,
  onDeprovision: (bizId: string, serviceId: string | null) => Promise<void>
) {
  const client = await pool.connect();
  try {
    const alive = await client.query(
      `SELECT id, bwl_service_id, wallet_balance_cached, updated_at
       FROM businesses WHERE status = 'alive'`
    );
    for (const r of alive.rows) {
      const bal = Number(r.wallet_balance_cached);
      const ageHrs = (Date.now() - new Date(r.updated_at).getTime()) / 3600_000;
      if (bal < 0.5 && ageHrs > 24) {
        await client.query(
          `UPDATE businesses SET status = 'dying', status_changed_at = NOW() WHERE id = $1`,
          [r.id]
        );
      }
    }
    const dying = await client.query(
      `SELECT id, bwl_service_id, wallet_balance_cached, status_changed_at
       FROM businesses WHERE status = 'dying'`
    );
    for (const r of dying.rows) {
      const bal = Number(r.wallet_balance_cached);
      const ageHrs = (Date.now() - new Date(r.status_changed_at).getTime()) / 3600_000;
      if (bal < 0.25 && ageHrs > 24) {
        await client.query(
          `UPDATE businesses SET status = 'dead', deprovision_reason = 'out of funds', status_changed_at = NOW() WHERE id = $1`,
          [r.id]
        );
        await onDeprovision(r.id, r.bwl_service_id);
      }
    }
  } finally {
    client.release();
  }
}
