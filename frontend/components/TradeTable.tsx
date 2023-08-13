import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "components/ui/table";
import { truncateAddress } from "utils";
import Address from "components/Address";
import type { ReactElement } from "react";
import { formatDistance } from "date-fns";
import type { TradeWithTwitterUser } from "pages/api/stats/trades";

export default function TradeTable({
  trades,
}: {
  trades: TradeWithTwitterUser[];
}) {
  return (
    <Table className="[&_td]:py-1">
      <TableHeader>
        <TableRow>
          <TableHead>Hash</TableHead>
          <TableHead>Time Since</TableHead>
          <TableHead>Block #</TableHead>
          <TableHead>From</TableHead>
          <TableHead>Token</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Net</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {trades.map((trade, i) => {
          // Render row background depending on trade type
          function ColoredRow({ children }: { children: ReactElement[] }) {
            return trade.isBuy ? (
              <TableRow className="bg-buy-30">{children}</TableRow>
            ) : (
              <TableRow className="bg-sell-30">{children}</TableRow>
            );
          }

          return (
            <ColoredRow key={i}>
              <TableCell>
                <a
                  href={`https://basescan.org/tx/${trade.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {truncateAddress(trade.hash, 6)}
                </a>
              </TableCell>
              <TableCell suppressHydrationWarning={true}>
                {formatDistance(new Date(trade.timestamp * 1000), new Date(), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell>
                <a
                  href={`https://basescan.org/block/${trade.blockNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {trade.blockNumber}
                </a>
              </TableCell>
              <TableCell>
                <Address
                  address={trade.fromAddress}
                  username={trade.fromUser.twitterUsername}
                  image={trade.fromUser.twitterPfpUrl}
                />
              </TableCell>
              <TableCell>
                <Address
                  address={trade.subjectAddress}
                  username={trade.subjectUser.twitterUsername}
                  image={trade.subjectUser.twitterPfpUrl}
                />
              </TableCell>
              <TableCell>
                {trade.isBuy ? "+" : "-"}
                {trade.amount}
              </TableCell>
              <TableCell>
                {trade.isBuy ? (
                  <span className="text-buy">
                    {(Number(trade.cost) / 1e18).toFixed(6)} Ξ
                  </span>
                ) : (
                  <span className="text-sell">
                    {(Number(trade.cost) / 1e18).toFixed(6)} Ξ
                  </span>
                )}
              </TableCell>
            </ColoredRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
