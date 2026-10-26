# Scripts: Commands You Can Reuse

Typing a command into your terminal runs it once. A **script** is a plain text file that holds one or more commands, so you can run the same steps again and again just by running the file.

## Create the script file

Use any text editor to create a file named:

- `my_script.sh` on Mac or Linux
- `my_script.ps1` on Windows (PowerShell)

Put this single line in it, and save the file:

```bash
echo "Hello, Operator"
```

The `echo` command prints text to the terminal. It works the same way in both `bash` and PowerShell.

## Run your script

Open your terminal, move to the folder where you saved the file (the `cd` command from the last challenge), and run it.

On Mac or Linux:

```bash
bash my_script.sh
```

On Windows, in PowerShell:

```powershell
.\my_script.ps1
```

If PowerShell tells you that running scripts is disabled on this system, that is a safety setting on your computer. You can still complete the challenge - the game only checks that your script file exists and contains an `echo` command.

You should see `Hello, Operator` printed back to you.

## Find the full path

To paste the path into the game, you need the full location of the file. From the folder that holds your script, run `pwd` (you used it earlier) and add the file name to the end. For example:

```
/home/you/quest/my_script.sh
```

On Windows, in PowerShell, `Get-Item .\my_script.ps1 | Select-Object -ExpandProperty FullName` prints the full path.

## Why scripts matter

Almost every task you repeat as a developer - building a project, running tests, backing up files - eventually becomes a script. As in the last challenge, remember that a script runs with the same power as the commands you type, so **only run scripts you wrote or understand**.
