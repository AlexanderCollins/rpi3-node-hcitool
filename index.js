
let request = require('request');
const { exec } = require('child_process');

let i2c = require('i2c-bus');
let oled = require('oled-i2c-bus');

/* initalise serial id */
let serial_id;

class Display {
    constructor() {
        this.i2cBus = i2c.openSync(1)
        this.opts = {
            width: 128,
            height: 32,
            address: 0x3C
        };
        this.oled = new oled(this.i2cBus, this.opts);
        this.font = require('oled-font-5x7');
        this.oled.clearDisplay();
        this.oled.turnOnDisplay();
    }

    write_text(_text){
        this.oled.clearDisplay();
        this.oled.setCursor(1, 1);
        this.oled.writeString(this.font, 1, _text, 1, true);
    }
}

/*  
 * Define the interval between scans in MS and,
 *Enable promises for node-cmd with bluebird.<Promise> 
 */
let SCAN_INTERVAL = 1000;

let display = new Display();
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
    display.write_text(`${serial_id}Scanning for safedome devices ...`);
    let dir = exec("sudo btmgmt find", function(_, stdout, __) {
        let data = stdout.split("\n");

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

        display.write_text(`${serial_id}Found ${results.length} safedome devices.`)
        console.log(`[${get_timestamp()}] Found ${results.length} safedome devices.`);


        /* todo - parse data from hcitool */
        if(results.length > 0){
            let payload = {
                "devices": results,
                "timestamp": get_timestamp(),
                "device": serial_id
            };
            console.log(`[${get_timestamp()}] ${payload}`);
        }

        setTimeout(scan, SCAN_INTERVAL);
    });
      
    dir.on('exit', function (code) {
        console.log(`[${get_timestamp()}] <scan> command line function exited with code: <${code}> (0: success, 1: failure).`);
    });

};


/* Get the serial number */
let get_id = exec("sudo cat /proc/cpuinfo | grep Serial | sed 's/ //g' | cut -d ':' -f2", function(_, stdout, stderr) {
    console.log(`[${get_timestamp()}] Found device serial id ${stdout}.`);
    serial_id = stdout;
    return;
});

get_id.on('exit', function(code) {
    /* Begin Logging */
    console.log(`[${get_timestamp()}] <get device serial id> command line function exited with code: <${code}> (0: success, 1: failure).`);
    setTimeout(scan, SCAN_INTERVAL);
});
