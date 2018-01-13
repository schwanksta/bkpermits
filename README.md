A Twitter bot that runs through the latest permits approved in a neighborhood, and tweets out any new "new building" or "demolition" permits.

Runs on the AWS Lambda infrastructure. It is kinda cool.

To get this working, you need an AWS account and a Twitter account

```bash
$ cp deploy.env.template deploy.env
$ cp deploy.env .env
```

And fill out both of those envs with your keys. 

This is designed to work with `node-lambda`, so kick the tires with:

```bash
$ node-lambda run
```

And deploy with 

```bash
$ node-lambda deploy -t 60 -o arn:aws:iam::IAM_ID:role/IAM_ROLE -f deploy.env -r us-east-1
```
