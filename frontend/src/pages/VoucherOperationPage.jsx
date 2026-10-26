import React from "react";
import { useParams } from "react-router-dom";
import AccountsTransactionCenter from "./AccountsTransactionCenter.jsx";

const operationTabs = {
  purchase: "purchase",
  sale: "sale",
  "job-order": "job",
  production: "production",
  grading: "grading",
  pi: "pi",
  return: "return",
  damage: "damage",
  repacking: "repack",
  "packing-conversion": "packing",
  "bom-costing": "bom",
  "stock-ledger": "stock",
  documents: "documents",
};

export default function VoucherOperationPage() {
  const { operation } = useParams();
  const initialTab = operationTabs[operation];

  if (!initialTab) {
    return <main style={{padding:24}}><h1>Operation not found</h1><p>The requested Voucher Center page does not exist.</p></main>;
  }

  return <AccountsTransactionCenter key={initialTab} initialTab={initialTab} standalone />;
}
