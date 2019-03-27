let config = {
    "iceServers": [
        {
            "urls": "stun:global.stun.twilio.com:3478?transport=udp"
        },
        {
            "username": "87b67fde714dfaf29d3c812bc02a17e17c105da9404bfc7e6bd20a51e4658943",
            "credential": "Gj3uwxq//jH7kjfd0g4WAZJ3sTGTV5mWzx9AOS8zuQI=",
            "urls": "turn:global.turn.twilio.com:3478?transport=udp"
        },
        {
            "username": "87b67fde714dfaf29d3c812bc02a17e17c105da9404bfc7e6bd20a51e4658943",
            "credential": "Gj3uwxq//jH7kjfd0g4WAZJ3sTGTV5mWzx9AOS8zuQI=",
            "urls": "turn:global.turn.twilio.com:3478?transport=tcp"
        },
        {
            "username": "87b67fde714dfaf29d3c812bc02a17e17c105da9404bfc7e6bd20a51e4658943",
            "credential": "Gj3uwxq//jH7kjfd0g4WAZJ3sTGTV5mWzx9AOS8zuQI=",
            "urls": "turn:global.turn.twilio.com:443?transport=tcp"
        }
    ]
};

function startPeer1() {
    let peer1 = new Peer({ config: config, initiator: true })
    peer1.on('signal', function (data) {
        //peer2.signal(data)
        console.log("signal = " + data.sdp);
        var start = { sdp: data.sdp.toString('hex'), accountId: '12323', token: 'token1', tags: '聊天室' };
        socket.emit('live-start', start)

    })

    peer1.on('connect', function () {
        // wait for 'connect' event before using the data channel
        //peer1.send('hey peer2, how is it going?')
    })
}

module.exports = {startPeer1}