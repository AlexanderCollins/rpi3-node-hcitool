
let request = require('request');
let Promise = require('bluebird');
let cmd = require('node-cmd');

let i2c = require('i2c-bus');
let oled = require('oled-i2c-bus');

class Display {
    constructor() {
        this.i2cBus = i2c.openSync(1)
        this.opts = {
            width: 128,
            height: 32,
            address: 0x3C
        };
        this.oled = new oled(i2cBus, opts);
        this.font = require('oled-font-5x7');
        this.oled.clearDisplay();
        this.oled.turnOnDisplay();
    }

    write_text(_text){
        this.oled.clearDisplay();
        this.oled.setCursor(1, 1);
        this.oled.writeString(font, 1, _text, 1, true);
    }
}

/*  
 * Define the interval between scans in MS and,
 *Enable promises for node-cmd with bluebird.<Promise> 
 */
const SCAN_INTERVAL = 5000, 
getAsync = Promise.promisify(cmd.get, { multiArgs: true, context: cmd });

const display = Display();
display.write_text(`Initialising Safedome Bluetooth Scanner.`);

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
    getAsync('sudo btmgmt find').then(data => {
        console.log(`[${get_timestamp()}] <${data}>`);

        data = data.split("\n");

        /* remove first two and last one element(s) from data array */
        data = data.splice(2);
        data.splice(-1);
        
        /* format into devices array */
        let devices = new Array();
        let current_device = "";
        for(var i=0; i<data.length; ++i){
            if((i+1) % 3 == 0) {
                // check that the device is a safedome device, if so, push to devices list.
                if(data[i].indexOf('safedome') !== -1){
                    devices.push(current_device);
                }
                current_device = ""
            } else {
                current_device = current_device + " " + data[i];
            }
        }

        let results = devices.map((device) => {
            let args = device.split(" ");
            let hex_id = args[2];
            let rssi = args[7];
        })

        display.write_text(`Found ${results.length} safedome devices.`)

        /* todo - parse data from hcitool */

        let payload = {
            "devices": results,
            "timestamp": get_timestamp()
        };

        /* Log data with server */
        // post_data(
        //     payload,
        //     () => {setTimeout(scan, SCAN_INTERVAL);}
        // )
    }).catch(err => {
        /* Log exceptions */
        console.error(`[${get_timestamp()}]`, err);
        setTimeout(scan, SCAN_INTERVAL);
    });    
};

/* Begin Logging */
//setTimeout(scan, SCAN_INTERVAL);
