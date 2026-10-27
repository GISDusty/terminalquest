#!/bin/sh
# A stand-in for rustc, so you can test the validator's find / spawn / timeout
# logic on a machine without Rust. It is NOT a compiler. It understands
#   fake_rustc.sh --version
#   fake_rustc.sh [flags] -o OUTPUT SOURCE.rs
# and "compiles" by writing a tiny shell script to OUTPUT:
#   - source contains Vec<u8>      -> prints a rustc-looking error (with < > &
#                                     and colour codes) and exits 1
#   - source contains hang_compiler -> starts a long sleep and waits (to test
#                                     killing a compiler that never finishes)
#   - source contains "loop {}"     -> the output script loops forever
#   - otherwise                     -> the output script echoes the string in
#                                     the first println!("...") of the source
if [ "$1" = "--version" ]; then
  echo "rustc 0.0.0 (stand-in, not a real compiler)"
  exit 0
fi

out=""
src=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    -*) shift ;;
    *) src="$1"; shift ;;
  esac
done

if grep -q 'Vec<u8>' "$src"; then
  printf '\033[1m\033[31merror[E0308]\033[0m: mismatched types: expected `Vec<u8>`, found `&str` & more\n --> %s:2:5\n' "$src" >&2
  exit 1
fi

if grep -q 'hang_compiler' "$src"; then
  sleep 7331 &
  wait
fi

if grep -q 'loop {}' "$src"; then
  body='while :; do :; done'
else
  text=$(sed -n 's/.*println!("\(.*\)").*/\1/p' "$src" | head -1)
  body="printf '%s\\n' '$text'"
fi

printf '#!/bin/sh\n%s\n' "$body" > "$out"
chmod +x "$out"
