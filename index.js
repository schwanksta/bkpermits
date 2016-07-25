var got = require('got'),
	emoj = require('emoj'),
	twit = require('twit'),
	title = require('to-title-case'),
	journalize = require('journalize'),
    dateformat = require('dateformat'),
    aws = require('aws-sdk'),
    _ = require('underscore');

aws.config.region = 'us-east-1';

var s3bucket = new aws.S3({params: { Bucket: process.env.S3_BUCKET }});

var options = {
	json: true,
	headers: {
		"X-API-Key": process.env.CAMPFIN_API_KEY
	}
}

var T = new twit({
  consumer_key:         process.env.TWITTER_CONSUMER_KEY,
  consumer_secret:      process.env.TWITTER_CONSUMER_SECRET,
  access_token:         process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret:  process.env.TWITTER_ACCESS_TOKEN_SECRET,
  timeout_ms:           60*1000,  // optional HTTP request timeout to apply to all requests.
})

exports.handler = (event, context, callback) => {
    console.log("Starting");
    got( "https://api.propublica.org/campaign-finance/v1/2016/independent_expenditures.json", options)
    .then(response => {
        s3bucket.getObject({  Bucket: process.env.S3_BUCKET, Key: "fecvenmo-lastid" }, (err, data) => {
            if (err) {
              console.log("Could not get S3 object ", err);
              context.done()
              process.exit(1)
            } 
            var lastid = parseInt(data.Body.toString('utf-8'));
            var ids = _.uniq(_.pluck(response.body.results, "filing_id").sort().reverse(), true)
            var idxLast = ids.indexOf(lastid);

            console.log("last fec id: ", lastid);
            if(idxLast == -1) {
                // We need to walk back more in the feed, butttttt
                idxLast = ids.length;
            }

            var newIds = ids.slice(0, idxLast);
            console.log("New filings: ", newIds.length);

            response.body.results.forEach((val, index, array) => {
                if(newIds.indexOf(val.filing_id) >=0 && val.amount >= 4000) {
                    emoj(val.purpose).then(arr => arr.slice(0, 3).join('  ')).then(emojis => {
                        var nice_date = dateformat(Date(val.date), "m/d/yy");
                        var status = title(val.fec_committee_name) + " ► " + title(val.payee) + ", $" + journalize.intcomma(val.amount) + "\n\n" + emojis + "  " + val.purpose.toLowerCase();
                        var withlink = status.slice(0, 113) + "\n" + "https://projects.propublica.org/itemizer/filing/" + val.filing_id + "/schedule/se"
                        T.post('statuses/update', { status: withlink }, (err, data, response) => {
                            if(err) { console.log(err) }
                            else { console.log(status) }
                        })
                    })
                }
            });

            if(newIds.length > 0) {
                s3bucket.upload({ Key: "fecvenmo-lastid", Body: ids[0].toString() }, (err, data) => {
                    if (err) console.log("Error uploading data: ", err);
                    else console.log("Successfully uploaded data to " + process.env.S3_BUCKET + "/fecvenmo-lastid");
                });
            }
        });
    })
};
