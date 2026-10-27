# Need a hint?

A complete Rust program that passes is only three lines:

```rust
fn main() {
    println!("Hello, TerminalQuest!");
}
```

`println!` ends in an exclamation mark because it is a macro, not a function.
The text goes inside double quotes.

## Check it yourself first

In a terminal, in the folder that holds `main.rs`:

```
rustc main.rs
./main
```

On Windows the second line is `main.exe`. If that prints the right text, the
terminal in the game will accept it.

## "I could not find rustc"

The game may start without the folder that holds `rustc` on its search path.
Find it in a terminal with `which rustc` (macOS and Linux) or `where rustc`
(Windows), then paste that path into the second box. With `rustup` it is
usually `~/.cargo/bin/rustc`.

## Errors

If your program does not compile, the terminal shows the compiler's first
error. Fix the first one and try again. Later errors are often caused by the
first.
