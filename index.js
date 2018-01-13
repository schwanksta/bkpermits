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
	json: true
}

var T = new twit({
  consumer_key:         process.env.TWITTER_CONSUMER_KEY,
  consumer_secret:      process.env.TWITTER_CONSUMER_SECRET,
  access_token:         process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret:  process.env.TWITTER_ACCESS_TOKEN_SECRET,
  timeout_ms:           60*1000,  // optional HTTP request timeout to apply to all requests.
})


var permits_url = "https://data.cityofnewyork.us/resource/ipu4-2q9a.json?NTA_NAME=Prospect%20Lefferts%20Gardens-Wingate&$where=(permit_type%20=%20%27DM%27%20OR%20permit_type%20=%20%27NB%27)%20AND%20issuance_date%20IS%20NOT%20NULL%20AND%20filing_status%20!=%20%27RENEWAL%27&$order=issuance_date%20desc&$limit=25"

exports.handler = (event, context, callback) => {
    got( permits_url, options)
    .then(response => {
        s3bucket.getObject({  Bucket: process.env.S3_BUCKET, Key: "plgpermits-lastid" }, (err, data) => {
            if (err) {
              console.log("Could not get S3 object ", err);
              console.log("setting to 0")
              var lastid = 0
            } else {
              var lastid = data.Body.toString('utf-8');
            }
            var ids = _.uniq(_.pluck(response.body, "permit_si_no"), true)
            var idxLast = ids.indexOf(lastid);
            console.log(idxLast)
            console.log("Last permit number: ", lastid);
            if(idxLast == -1) {
                // We should walk back more in the feed, butttttt
                idxLast = ids.length;
            }

            var newIds = ids.slice(0, idxLast);
            console.log("New permits: ", newIds.length);

            response.body.forEach((val, index, array) => {
                if(newIds.indexOf(val.permit_si_no) >=0 ) {
                    if(val.permit_type == "DM") {
                        var status = "New demolition permit issued for " + val.house__ + " " + title(val.street_name) + ", " + val.zip_code
                    } else if(val.permit_type == "NB") {
                        var status = "New building permit issued for " + val.house__ + " " + title(val.street_name) + ", " + val.zip_code
                    }
                    status += " http://a810-bisweb.nyc.gov/bisweb/JobsQueryByNumberServlet?passjobnumber=" + val.job__
                    console.log("posting")
                    T.post('statuses/update', { status: status.slice(0, 279) }, (err, data, response) => {
                        if(err) { console.log(err) }
                        else { console.log(status) }
                    })
                }
            });

            if(newIds.length > 0) {
                s3bucket.upload({ Key: "plgpermits-lastid", Body: ids[0].toString() }, (err, data) => {
                    if (err) console.log("Error uploading data: ", err);
                    else console.log("Successfully uploaded data to " + process.env.S3_BUCKET + "/plgpermits-lastid");
                });
            }
        });
    })
};
