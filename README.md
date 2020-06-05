# UCPeM [![Testing](https://github.com/bt7s7k7/UCPeM/workflows/Testing/badge.svg)](https://github.com/bt7s7k7/UCPeM/actions?query=workflow%3ATesting)
UCPeM is used to import packages into projects. A package is defined in using a port which is a special type of package, that exports resources. In a project these resources can be imported into resource links, which are folder junctions to the cloned repositories of ports. 

## Config
A project contains `ucpem_config` file defining a name, imports and exports. To import a resource type:
```xml
"import" <port>
<resource>...
"end" 
```
Port is a path for `git clone`. Resource names must be `[a-zA-Z0-9_]+`.

Port must be a git clone URL. Imported resources are placed relative to the config file of the project in `${resourceName}.ucpem`. All cloned repos will be placed into a `~ucpem_ports` folder in the root of the project. 

To export a resource from a port write:
```xml
"export" 
<resource>...
"end"
```

Ports can have a preparation script. It's run when the port is cloned, updated or manually using `ucpem prepare`. 
```xml
"prepare"
<command>...
"end"
``` 

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
```
Run ucpem without arguments to view help.
## .gitignore for projects
```git
# Just add
*.ucpem
~ucpem_ports
```
