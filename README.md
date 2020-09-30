# UCPeM [![Testing](https://github.com/bt7s7k7/UCPeM/workflows/Testing/badge.svg)](https://github.com/bt7s7k7/UCPeM/actions?query=workflow%3ATesting)
UCPeM is used to import packages into projects. A package is defined in using a port which is a special type of package, that exports resources. In a project these resources can be imported into resource links, which are folder junctions to the cloned repositories of ports. 

## Config
A project contains an `ucpem_config` file, defining default imports, resources and their dependencies. 

Lines starting with `#` are comments, and are ignored by the parser.

To specify default imports write:
```xml
"default" 
    (<port>
        <resource>...
    "end")...
"end"
```
Port is a repository path (for `git clone`). Resource names should be `[a-zA-Z0-9_]+` and cannot contain whitespace.

Port must be a git clone URL. Imported resources are placed relative to the config file of the project in a `${resourceName}` folder. All cloned repos will be placed into a `ucpem_ports~` folder in the root of the project. Don't worry about source control, a `.gitignore` file will be generated automatically.

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

If your project files are offset from the config folder (i.e. in a `src` folder) you can prefix the project path
```xml
"prefix" <path>
```
## Installation
1. Install globally
```
git clone https://github.com/bt7s7k7/UCPeM.git
npm install
npm run build
npm link
```
2. Run once
```html
curl -L https://github.com/bt7s7k7/UCPeM/releases/latest/download/index.js | node - <arguments>
```
## Usage
```
Usage:
  ucpem <operation>

Operations:
  install - Downloads and prepares all ports
  update  - Updates all ports
  prepare - Runs all prepare scripts in this project
  info    - Prints information about this project
  link    - Recreates all links to imports
```
Run `ucpem` without arguments to view help.