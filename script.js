document.addEventListener("DOMContentLoaded", () => {
    const connectBtn = document.getElementById("connectBtn");
    const sendBtn = document.getElementById("sendBtn");
    
    const scanBtn = document.getElementById("scanBtn");
    const configBtn = document.getElementById("configBtn");

    const statusElem = document.getElementById("status");
    const outputElem = document.getElementById("output");
    const inputField = document.getElementById("inputField");

    const scanCommand =  new Uint8Array([
        0x40,  // Flags (Write, wants a reply)
        0x00,  // Sequence Byte
        0x03,  // Data length (LSB)
        0x00,  // Data length (MSB)
        0x02,  // Command byte
        0x18,  // Group byte
        0x00  // Additional data
    ]);

    const readConfig = new Uint8Array([
        0xC0,  // Flags Byte (1100 0000) - Read, wants a reply
        0x00,  // Sequence Byte (set to 0)
        0x02,  // Length of data (LSB)
        0x00,  // Length of data (MSB) - not used here
        0x23,  // Command Byte
        0x02  // Group Byte
               // Additional data if any
    ]);
    let device = null;

    async function connectToHID() {
        try {
            const filters = [
                { vendorId: 0x0451 } 
            ];

            device = await navigator.hid.requestDevice({ filters });
            if (device.length > 0) {
                device = device[0];
                await device.open();
                statusElem.textContent = `Status: Connected to ${device.productName}`;
                startReading();
            } else {
                statusElem.textContent = "Status: No device selected.";
            }
        } catch (error) {
            console.error("Error connecting to HID device:", error);
            statusElem.textContent = "Status: Failed to connect.";
        }
    }

    async function startReading() {
        if (!device) return;

        try {
            device.addEventListener("inputreport", (event) => {
                const { data } = event;
                const decoder = new TextDecoder();
                const decoded = decoder.decode(data);
                outputElem.value += `\n${decoded}`;
                outputElem.scrollTop = outputElem.scrollHeight;
            });

            console.log("Started listening for input reports.");
        } catch (error) {
            console.error("Error reading from device:", error);
        }
    }


    async function sendCommand(command) {
        if (!device) {
            alert("sendCommand: Device not connected "+ command.toString());
            return;
        }

        try {
            await device.sendReport(0x00, command);
        } catch (error) {
            console.error("Error sending command:", error);
        }
    }

    async function scan() {
        console.log("Scanning",scanCommand);
        await sendCommand(scanCommand);
    }
    async function getConfig() {
        console.log("Reading config",readConfig);
        await sendCommand(readConfig);
    }


    async function sendData() {
        if (!device) {
            alert("No device connected.");
            return;
        }

        try {
            // Convert input to hexadecimal
            const hexValues = inputField.value.split(',').map(hexStr => parseInt(hexStr.trim(), 16));
            const data = new Uint8Array(hexValues);

            await device.sendReport(0x00, data); // Replace 0x00 with the appropriate report ID for your device
            inputField.value = "";
        } catch (error) {
            console.error("Error sending data:", error);
        }
    }

    connectBtn.addEventListener("click", connectToHID);
    sendBtn.addEventListener("click", sendData);
    scanBtn.addEventListener("click", scan);
    configBtn.addEventListener("click", getConfig);
});
