# github-tools

## Prerequisites

- [NodeJS](https://nodejs.org/en/download/current/)
- [Git](https://git-scm.com/downloads)
- [A GitHub SSH Key](https://github.com/settings/keys)
- [A GitHub Personal Access Token](https://github.com/settings/tokens) with sufficient read privileges

## Usage

From the command line, run:

`node clone.js PERSONAL_ACCESS_TOKEN`

TODO: `ORG_NAME` is currently hard-coded. Change to arg.

## SSH Key

For full instructions on setting up a new SSH key, see [GitHub Help](https://help.github.com/articles/adding-a-new-ssh-key-to-your-github-account/). 

The instructions above refer to the **Git bash shell**. To open the Git bash shell On Windows, use the following command: `start "" "%PROGRAMFILES%\Git\bin\sh.exe" --login`

## Misc

To avoid the default file name length on Windows, use a shorter path to the tool, e.g.: C:\githubtools\

The maximum file name length can also be increased using regedit.
