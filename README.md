# Picnic Grocy Bridge

> ## Very much WIP 

# A CLI application to push a Picnic order/basket into Grocy

## install deps

```
$ yarn
```

## run

```
$ yarn ts-node src/index.ts
```

```
Options:
  -d, --debug                       extra debugging
  -c, --country <country>           Country code (DE or NL)
  -e, --email <email>               picnic email
  -p, --password <password>         picnic password
  -u, --grocy-url <url>             grocy url
  -k, --picnic-auth-key <auth-key>  picnic auth key
  -a, --api-key <api-key>           grocy api key
  -V, --version                     output the version number
  -h, --help                        display help for command

Commands:
  login                             login in to picnic and store the auth key
                                    in datadir
  import-basket                     import the grocy basket
  import-last-order                 import the last order
  import-order <order-id>           import the order with given id
  scan                              connect picnic products with barcodes
  help [command]                    display help for command
```


## TODOs

- prettier, eslint
- make it possible to set options in the environment or a config file
- rework data persistence
- make scan logs less shit
- maybe convert this into a server instead of a cli
