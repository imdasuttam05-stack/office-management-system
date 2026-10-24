# Accounting hardening patch (2026-10-24)

## Included in this patch
- Rejects a repeated supplier invoice reference for the same supplier/company during purchase creation and edit (case-insensitive; ignores repeated whitespace).
- Rejects a repeated customer invoice reference for the same customer/company during sales creation and edit.
- Adds normalized reference fields and unique MongoDB indexes for new supplier/customer reference values to protect against concurrent duplicate saves.
- Adds an idempotency guard to automatic accounting voucher creation so the same source document reuses its existing automatic voucher rather than generating another one.
- Adds Enter / Shift+Enter field navigation to AccountsWorkspace for keyboard-first entry while preserving native select, textarea, button and Escape behavior.

## Important limitations before production
- This is a hardening patch, not a claim of complete Tally parity.
- Bill-wise allocation of Receipt/Payment/Journal/Debit Note/Credit Note against open Sales/Purchase invoices still needs a dedicated outstanding-bills selector and allocation persistence/reversal workflow. The current `referenceNo` field alone is not a complete bill-wise accounting implementation.
- MongoDB must successfully build the new unique indexes. If the database already has normalized duplicate references, resolve those duplicates before deployment.
- Existing transactions are not automatically migrated into bill-wise allocations.
- Frontend production build could not be run in this environment because dependencies were unavailable from the package registry/cache. Backend files passed Node syntax checks; full integration testing against a staging MongoDB is still required.

## Deployment advice
Deploy to a staging Render service / test database first. Do not test duplicate invoice protections against live accounting data until the indexes and current duplicate records have been checked.
