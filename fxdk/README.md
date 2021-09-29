# FxDK "Code - OSS" adaptation

 - Browse all changes made to original "Code - OSS" by searching for `NOTE@FXDK`
 - Use `git commit --amend` so we can rebase just one commit when updating to upstream

## Notes

- Warning `View container 'remote' does not exist and all views registered to it will be added to 'Explorer'.` is normal while in dev mode
  it is due to that we disable remote indicator and it comes from `vscode-api-tests` extension that is not part of final build.

## Todos
- Get rid of all `Reveal in Side Bar` things, should replace with `Reveal in Project Explorer` instead
