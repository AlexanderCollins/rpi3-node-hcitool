
import request from 'request';
import Promise from 'bluebird';
import cmd from 'node-cmd';

/*  
 * Define the interval between scans in MS and,
 *Enable promises for node-cmd with bluebird.<Promise> 
 */
const SCAN_INTERVAL = 5000, 
getAsync = Promise.promisify(cmd.get, { multiArgs: true, context: cmd });


let get_timestamp = () => {
    /* Format current datetime to human readable timestamp. */
    return (new Date()).toJSON().slice(0, 19).replace(/[-T]/g, ':');
},

/* Log data with server */
post_data = (data, cb) => {
    request.post(
        {
            url: "https://",
            method: "POST",
            json: data
        }, 
        function optionalCallback(err, _, body) {
            if (err) {
                console.error(`[${get_timestamp()}]`, err);
                return cb();
            }
            console.log(`[${get_timestamp()}] Logged <${data.devices.length}> devices. Response from server: <${body}>.`);
            cb();
        }
    );
},

/* Scan and log devices*/
scan = () => {
    getAsync('hcitool scan --flush').then(data => {
        console.log(`[${get_timestamp()}] <${data}>`)

        /* todo - parse data from hcitool */

        let payload = {
            "devices": data,
            "timestamp": get_timestamp()
        };

        /* Log data with server */
        post_data(
            payload,
            () => {setTimeout(scan, SCAN_INTERVAL);}
        )
    }).catch(err => {
        /* Log exceptions */
        console.error(`[${get_timestamp()}]`, err);
        setTimeout(scan, SCAN_INTERVAL);
    });    
};

/* Begin Logging */
setTimeout(scan, SCAN_INTERVAL);
