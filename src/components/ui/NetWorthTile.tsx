import Tile from '@/components/ui/Tile';
import { fmtCurrency } from '@/lib/format';

type NetWorthTileProps = {
  netWorth: number;
  className?: string;
};

export default function NetWorthTile({ netWorth, className }: NetWorthTileProps) {
  const isPositive = netWorth >= 0;

  return (
    <Tile
      title="Net Worth"
      value={`${isPositive ? '' : '−'}${fmtCurrency(Math.abs(netWorth))}`}
      size="lg"
      align="center"
      className={className}
      titleClassName="font-semibold uppercase tracking-wide"
      valueClassName="font-bold text-[clamp(1.5rem,6vw,2.75rem)]"
      valueStyle={{ color: isPositive ? '#10b981' : '#f43f5e' }}
    />
  );
}
