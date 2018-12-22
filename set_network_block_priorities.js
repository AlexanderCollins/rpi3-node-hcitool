var fs = require('fs');
const { exec } = require('child_process');

let get_timestamp = () => {
    /* Format current datetime to human readable timestamp. */
    return (new Date()).toJSON().slice(0, 19).replace(/[-T]/g, ':');
};


function update_supplicant(network_block_count) {
    var array = fs.readFileSync('/etc/wpa_supplicant/wpa_supplicant.conf').toString().split("\n");
    let priority_count = 0;
    let new_array = new Array();

    /* Iterate over each line in the existing wpa_supplicant file and add priority to each network block */
    for(var index = 0; index < array.length; ++index) {
        if(array[index].indexOf('}') !== -1){
            new_array.push(`\tpriority=${network_block_count - priority_count}`);
            priority_count++;
        }
        new_array.push(array[index]);
    }


    fs.writeFileSync('temp.conf', new_array.join("\n"), 'utf8');

    let copy_temp_to_supplicant = exec("sudo cp ./temp.conf /etc/wpa_supplicant/wpa_supplicant.conf", function(_, stdout, __){
        console.log(stdout);
    });

    copy_temp_to_supplicant.on('exit', function (code) {
        console.log(`[${get_timestamp()}] <copy_temp_to_supplicant> command line function exited with code: <${code}> (0: success, 1: failure).`);
    });
}



let network_count_command = exec("cat /etc/wpa_supplicant/wpa_supplicant.conf | grep network | wc -l", function(_, stdout, __){
    let network_block_count = parseInt(stdout);
    update_supplicant(network_block_count);
});

/* Log the result of the network count command */
network_count_command.on('exit', function (code) {
    console.log(`[${get_timestamp()}] <network_count_command> command line function exited with code: <${code}> (0: success, 1: failure).`);
});