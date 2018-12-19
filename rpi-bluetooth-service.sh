#!/bin/bash
sleep 8
cd /home/pi/rpi3-node-hcitool
forever start index.js >>/home/pi/output.log 2>>/home/pi/error.log
