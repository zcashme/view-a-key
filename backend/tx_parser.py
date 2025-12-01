import logging

from config import HEX_CHARS

log = logging.getLogger(__name__)


def _looks_like_txid(line: str) -> bool:
    s = line.strip()
    if len(s) < 32:
        return False
    return all(c in HEX_CHARS for c in s)


def parse_list_tx_text(text: str):
    """
    Parse zcash-devtool 'list-tx' text into a structured list of transactions.

    It is intentionally tolerant: if something doesn't match, it just stores
    the raw line instead of failing.
    """
    lines = text.splitlines()
    txs = []

    current_tx = None
    current_output = None
    i = 0

    while i < len(lines):
        line = lines[i].rstrip("\n")

        if not line.strip():
            i += 1
            continue
        if line.strip().startswith("Transactions:"):
            i += 1
            continue

        if not line.startswith(" ") and _looks_like_txid(line):
            if current_tx:
                txs.append(current_tx)
            current_tx = {
                "txid": line.strip(),
                "outputs": [],
            }
        else:
            if current_tx is None:
                i += 1
                continue

            stripped = line.strip()

            if stripped.startswith("Mined:"):
                rest = stripped[len("Mined:"):].strip()
                parts = rest.split(" ", 1)
                if parts:
                    try:
                        current_tx["mined_height"] = int(parts[0])
                    except ValueError:
                        current_tx["mined_height_raw"] = parts[0]
                    if len(parts) > 1:
                        current_tx["mined_time"] = parts[1].strip("() ")
            elif stripped.startswith("Amount:"):
                current_tx["amount"] = stripped[len("Amount:"):].strip()
            elif stripped.startswith("Fee paid:"):
                current_tx["fee"] = stripped[len("Fee paid:"):].strip()
            elif stripped.startswith("Sent ") and "notes" in stripped and "memos" in stripped:
                current_tx["note_summary"] = stripped
            elif stripped.startswith("Output "):
                out = {"raw_header": stripped}
                tokens = stripped.split()
                if len(tokens) >= 2 and tokens[1].isdigit():
                    out["index"] = int(tokens[1])
                if "(" in stripped and ")" in stripped:
                    out["pool"] = stripped[stripped.find("(") + 1:stripped.find(")")]
                current_tx["outputs"].append(out)
                current_output = out
            elif stripped.startswith("Value:") and current_output is not None:
                current_output["value"] = stripped[len("Value:"):].strip()
            elif stripped.startswith("Received by account:") and current_output is not None:
                current_output["account"] = stripped[len("Received by account:"):].strip()
            elif stripped.startswith("To:") and current_output is not None:
                current_output["to"] = stripped[len("To:"):].strip()
            elif stripped.startswith("Memo:") and current_output is not None:
                memo_lines = [stripped[len("Memo:"):].strip()]
                j = i + 1
                while j < len(lines) and lines[j].startswith(" "):
                    memo_lines.append(lines[j].strip())
                    j += 1
                memo = " ".join(memo_lines)

                if "Memo::Text(" in memo:
                    start = memo.find("Memo::Text(") + len("Memo::Text(")
                    if memo[start:].startswith('"'):
                        start += 1
                    end = memo.rfind('")')
                    if end == -1:
                        end = len(memo)
                    memo = memo[start:end]
                current_output["memo"] = memo
                i = j - 1

        i += 1

    if current_tx:
        txs.append(current_tx)

    return txs


def filter_txs_by_birthday(txs, birthday: int):
    """
    Enforce the birthday (start height) on the final transaction list.

    Any transaction with a known mined_height < birthday is dropped.
    Transactions with unknown height are kept.
    """
    if birthday is None:
        return txs

    filtered = []
    dropped = 0

    for tx in txs:
        h = tx.get("mined_height")
        if h is None:
            filtered.append(tx)
        elif h >= birthday:
            filtered.append(tx)
        else:
            dropped += 1

    if dropped:
        log.info(
            "Filtered out %d transactions below birthday height %d",
            dropped,
            birthday,
        )
    return filtered
