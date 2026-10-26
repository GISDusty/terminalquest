# Create a Git Repository

The official git website has a tutorial on [how to create a repository in an existing directory on your computer](https://git-scm.com/book/en/v2/Git-Basics-Getting-a-Git-Repository#_initializing_a_repository_in_an_existing_directory).

Instead of their sample project name, you'll want to create your git repository inside your JavaScript workspace directory at: `<%= env.TQ_JAVASCRIPT_WORKSPACE_PATH.value %>`.

## Your commands:

1. `cd "<%= env.TQ_JAVASCRIPT_WORKSPACE_PATH.value %>"`
2. `git init`
3. `git add -A`
4. `git commit -m "Initial commit"`

## If git asks who you are

The first time you commit, git may refuse and say something like `Please tell me who you are` or `Author identity unknown`. If that happens, tell git your name and email once, then run the commit again. Use your own values in place of the examples:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```
