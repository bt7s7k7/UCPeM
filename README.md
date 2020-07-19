# UCPeM [![Testing](https://github.com/bt7s7k7/UCPeM/workflows/Testing/badge.svg)](https://github.com/bt7s7k7/UCPeM/actions?query=workflow%3ATesting)
UCPeM is used to import packages into projects. A package is defined in using a port which is a special type of package, that exports resources. In a project these resources can be imported into resource links, which are folder junctions to the cloned repositories of ports. 

## Config
A project contains an `ucpem_config` file, defining default imports, resources and their dependencies. 

To specify default imports write:
```xml
"default" 
    (<port>
        <resource>...
    "end")...
"end"
```
Port is a path for `git clone`. Resource names must be `[a-zA-Z0-9_]+`.

Port must be a git clone URL. Imported resources are placed relative to the config file of the project in `${resourceName}.ucpem`. All cloned repos will be placed into a `ucpem_ports~` folder in the root of the project. 

To define a resource without dependencies (also called raw resource) write:
```xml
"raw" <name>
```

To define a resource with dependencies write:
```xml
"res" <name>
    (<port>
        <resource>...
    "end")...
"end"
```

Ports can have a preparation script. It's run when the port is cloned, updated or manually using `ucpem prepare`. 
```xml
"prepare" ["using" <type>]
<command>...
"end"
``` 
Prepare runners are:
 - `shell` → Run the script in the system shell (default)
 - `node` → Use JavaScript in a node environment

Prepare scripts get the following values: 
 - `OWN_NAME` → Name of the port
 - `OWN_PATH` → Path to the port
 - `IS_PORT` → If the script is being ran in a port
 - `PROJECT_PATH` → The name of the project
 - `PROJECT_NAME` → The path to the project
> In shell type runner the values are in environment variables prefixed with `UCPEM_`

Lines starting with `#` are comments.
## Installation
```
git clone https://github.com/bt7s7k7/UCPeM.git
npm link
```
## Usage
```
Usage:
  ucpem <operation>

Operations:
  install - Downloads and prepares all ports
  update  - Updates all ports
  prepare - Runs the prepare script for this package
  info    - Prints imports and config files of the current project
  link    - Recreates links for imported resources
```
Run ucpem without arguments to view help.
## Recommended .gitignore for projects
```git
# Just add
*.ucpem
ucpem_ports~
```
