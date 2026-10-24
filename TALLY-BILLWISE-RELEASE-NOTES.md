# Tally-style bill-wise accounting update

## Included
- Receipt can be allocated against open Sales Invoices for the selected customer ledger.
- Payment can be allocated against open Purchase Bills for the selected supplier ledger.
- Credit Note allocation is restricted to Sales Invoices; Debit Note allocation is restricted to Purchase Bills.
- The API checks party-ledger ownership, bill status, allocation amount, bill outstanding, voucher balance, and duplicate allocation of the same bill within a voucher.
- Bill-wise allocations are stored on the accounting voucher. Open-bill outstanding is calculated from allocations, including signed reversal allocations.
- A reversal endpoint and a Register action create a new reversing voucher; the original voucher remains unchanged for audit. A voucher can only be reversed once.
- Keyboard: Enter moves through input/select fields, Shift+Enter moves backwards, Up/Down moves between same-column voucher lines, and the existing F-key shortcuts remain available.
- Existing invoice duplicate checks and company/financial-year scoping from the supplied hardened ZIP are retained.

## API
- `GET /api/accounting/open-bills?type=SALE&partyLedgerId=<LedgerId>`
- `GET /api/accounting/open-bills?type=PURCHASE&partyLedgerId=<LedgerId>`
- `POST /api/accounting/vouchers` accepts `billAllocations: [{ invoiceType: "SALE"|"PURCHASE", invoiceId, amount }]` for Receipt, Payment, Debit Note and Credit Note.
- `POST /api/accounting/vouchers/:id/reverse` creates a reversing voucher and restores bill outstanding through a negative allocation.

## Important accounting behavior
- Receipt / Payment may be partially allocated; an unallocated amount is treated as on-account/advance.
- Debit Note / Credit Note must be allocated fully to one or more open bills.
- Debit Note is allocated to Purchase bills. Credit Note is allocated to Sales bills.
- The reversal operation reverses accounting lines and bill allocation metadata. It does not delete or rewrite the original voucher.

## Validation performed in this environment
- Node syntax checks passed for changed backend JavaScript files.
- TypeScript's JSX parser/transpiler reported no JSX syntax diagnostics for `frontend/src/pages/Accounting.jsx`.
- A full Vite production build and live MongoDB integration tests could not be run here because package installation did not complete and no configured test database/API credentials were available. Do not treat this as a verified production release until the checklist below passes in staging.

## Staging integration checklist
1. Create a Sales Invoice for ₹1,000 and confirm it appears under open Sales bills for that customer's Ledger.
2. Create a Receipt of ₹400 allocated to that bill. Outstanding should become ₹600.
3. Allocate another ₹600. Outstanding should become ₹0 and the bill should disappear from open bills.
4. Attempt to allocate ₹1 to the fully settled bill; API must reject it.
5. Create a Purchase Bill for ₹2,000 and repeat Payment allocations of ₹500 and ₹1,500.
6. Create a Credit Note linked to a Sales bill and a Debit Note linked to a Purchase bill; verify full allocation is required and the correct invoice type is enforced.
7. Reverse a Receipt/Payment/Note; original remains, reversal is added, bill outstanding is restored, and attempting a second reversal is rejected.
8. Test two simultaneous allocations against the same bill. If concurrent users are expected, run this test against the production MongoDB topology; use a transaction/reservation strategy if the environment permits concurrent over-allocation.
9. Verify company and financial-year isolation using two companies and two financial years.
10. Run frontend `npm install` and `npm run build`, then backend start/health check and API tests before deployment.
