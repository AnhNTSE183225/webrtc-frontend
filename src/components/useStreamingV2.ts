import { Client } from "@stomp/stompjs";
import { useEffect, useRef, useState } from "react";

declare global {
    interface RTCPeerConnection {
        dummyStream?: MediaStream;
    }
}

interface StreamingProps {
    userId: string;
    URL: string;
    roomId: string;
}

enum SignalState {
    JOIN = "JOIN",
    OFFER = "OFFER",
    ANSWER = "ANSWER",
    STARTSTREAM = "STARTSTREAM",
    STOPSTREAM = "STOPSTREAM",
    CANDIDATE = "CANDIDATE",
    LEAVE = "LEAVE"
}

interface SignalingMessage {
    type: SignalState;
    sender: string;
    receiver?: string;
    sdp?: any;
    candidate?: any;
    users?: [];
    streamers?: [];
}

// Create a more robust dummy stream that will be visible
const createDummyStream = () => {
    console.log("Creating dummy stream");

    // Create a larger canvas with visual content
    const canvas = document.createElement('canvas');
    canvas.width = 160;  // Larger size, but still minimal bandwidth
    canvas.height = 120;

    const ctx = canvas.getContext('2d');
    if (ctx) {
        // Create a more visible pattern
        ctx.fillStyle = '#222222';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = '24px Arial';
        ctx.fillStyle = '#888888';
        ctx.textAlign = 'center';
        ctx.fillText('No Stream', canvas.width / 2, canvas.height / 2);

        // Draw a small animation to ensure the stream is active
        setInterval(() => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#222222';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#888888';
            ctx.fillText('No Stream', canvas.width / 2, canvas.height / 2);
            const date = new Date();
            ctx.fillText(date.getSeconds().toString(), canvas.width / 2, canvas.height / 2 + 30);
        }, 1000);
    }

    // Capture at a reasonable frame rate
    const stream = canvas.captureStream(5); // 5fps is enough to be visible

    return stream;
};

export function useStreaming({ userId, URL, roomId }: StreamingProps) {

    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [isStreaming, setIsStreaming] = useState<boolean>(false);
    const [peers, setPeers] = useState<string[]>([]);

    const localStream = useRef<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
    const [streamers, setStreamers] = useState<string[]>([]);
    const activeStreams = Object.fromEntries(
        Object.entries(remoteStreams).filter(([userId]) => streamers.includes(userId))
    );

    const stompClient = useRef<Client | null>(null);
    const peerConnections = useRef<Record<string, RTCPeerConnection>>({});

    // Connect WebSocket
    const connectWebSocket = () => {
        const client = new Client({
            brokerURL: URL,
            onConnect: () => {
                setIsConnected(true);
                client.subscribe(`/topic/rooms/${roomId}`, (message) => {
                    const signal = JSON.parse(message.body) as SignalingMessage;
                    handleSignal(signal);
                });
                sendSignal({ type: SignalState.JOIN, sender: userId });
            },
            onDisconnect: () => {
                setIsConnected(false);
            }
        });
        client.activate();
        stompClient.current = client;
    }

    // Handles each signal
    const handleSignal = async (signal: SignalingMessage) => {
        if (signal.receiver && signal.receiver !== userId) return;
        console.log(signal);
        switch (signal.type) {
            case SignalState.JOIN: {
                if (signal.users) {
                    setPeers(signal.users);
                }
                if (localStream.current && signal.sender !== userId) {
                    setTimeout(() => {
                        reloadStream(signal.sender);
                    }, 2000);
                }
                break;
            }
            case SignalState.LEAVE: {
                if (signal.users) {
                    setPeers(signal.users);
                }
                break;
            }
            case SignalState.STARTSTREAM:
            case SignalState.STOPSTREAM: {
                if (signal.streamers) {
                    setStreamers(signal.streamers);
                }
                break;
            }
            case SignalState.OFFER: {
                const pc = createPeerConnection(signal.sender);

                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

                if (localStream.current) {
                    localStream.current.getTracks().forEach(track =>
                        pc.addTrack(track, localStream.current!)
                    );
                } else {
                    const dummyStream = createDummyStream();
                    pc.dummyStream = dummyStream;
                    dummyStream.getTracks().forEach(track =>
                        pc.addTrack(track, dummyStream)
                    );
                }

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                sendSignal({
                    type: SignalState.ANSWER,
                    sender: userId,
                    receiver: signal.sender,
                    sdp: answer
                });

                break;
            }
            case SignalState.ANSWER: {
                const pc = peerConnections.current[signal.sender];
                if (pc && signal.sdp) {
                    pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                }
                break;
            }
            case SignalState.CANDIDATE: {
                const pc = peerConnections.current[signal.sender];
                if (pc && signal.candidate) {
                    try {
                        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                        if (remoteStreams[signal.sender]) {
                            setTimeout(() => {
                                setRemoteStreams(prev => ({
                                    ...prev,
                                    [signal.sender]: { ...prev[signal.sender] }
                                }))
                            }, 1000);
                        }
                    } catch (error) {
                        console.error(`Error adding ICE candidate from ${signal.sender}:`, error);
                    }
                }
                break;
            }

        }
    }

    // Send a signal
    const sendSignal = (signal: SignalingMessage) => {
        stompClient.current?.publish({
            destination: `/app/signal/${roomId}`,
            body: JSON.stringify(signal)
        });
    }

    const startStream = async () => {
        if (!isConnected) return;

        if (localStream.current) {
            localStream.current.getTracks().forEach(track => track.stop());
        }

        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true
        });

        stream.getTracks().forEach(track => {
            track.onended = () => {
                sendSignal({type: SignalState.STOPSTREAM, sender: userId});
                setIsStreaming(false);
            }
        })

        for (const peer of peers.filter(p => p !== userId)) {
            const pc = createPeerConnection(peer);
            stream.getTracks().forEach(track => pc.addTrack(track, stream));

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            sendSignal({ type: SignalState.OFFER, sender: userId, receiver: peer, sdp: offer });
        }

        localStream.current = stream;
        sendSignal({ type: SignalState.STARTSTREAM, sender: userId });
        setIsStreaming(true);
    }

    const reloadStream = async (peerId: string) => {
        try {
            console.log(`Sending stream signal to new user ${peerId}`);

            console.log('Creating peer connection...');
            const pc = createPeerConnection(peerId);
            localStream.current!.getTracks().forEach(track => pc.addTrack(track, localStream.current!));

            console.log('Creating offer...');
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            console.log('Send signal?');
            sendSignal({ type: SignalState.OFFER, sender: userId, receiver: peerId, sdp: offer });
            sendSignal({ type: SignalState.STARTSTREAM, sender: userId});
        } catch (error) {
            console.error(error);
        }
    }

    const createPeerConnection = (peerId: string): RTCPeerConnection => {
        // Close existing connection
        if (peerConnections.current[peerId]) {
            peerConnections.current[peerId].close();
        }

        // New connection
        const connection = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" }
            ]
        });

        // Using ICE Candidate to bridge a connection discover public IP address
        connection.onicecandidate = (event) => {
            if (event.candidate) {
                sendSignal({
                    type: SignalState.CANDIDATE,
                    sender: userId,
                    candidate: event.candidate,
                    receiver: peerId
                })
            }
        }

        // Callback if received any connections
        connection.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
                const stream = event.streams[0];

                setRemoteStreams(prev => ({
                    ...prev,
                    [peerId]: stream
                }));

                // Then set up multiple refresh attempts to ensure stream is properly displayed
                const refreshStream = (attempt = 1, maxAttempts = 5) => {
                    if (attempt <= maxAttempts) {
                        setTimeout(() => {
                            console.log(`Refreshing stream for ${peerId}, attempt ${attempt}`);
                            setRemoteStreams(prev => {
                                if (prev[peerId]) {
                                    return { ...prev };  // Force a re-render
                                }
                                return prev;
                            });

                            // Schedule next attempt with increasing delay
                            refreshStream(attempt + 1, maxAttempts);
                        }, 1000 * attempt);  // Increasing timeout: 1s, 2s, 3s, etc.
                    }
                };

                refreshStream();
            }
        }

        // Callback handle disconnects
        connection.oniceconnectionstatechange = () => {
            if (connection.iceConnectionState === 'disconnected' ||
                connection.iceConnectionState === 'failed' ||
                connection.iceConnectionState === 'closed') {
                setRemoteStreams(prev => {
                    const newStreams = { ...prev };
                    delete newStreams[peerId];
                    return newStreams;
                });
            }
        };

        peerConnections.current[peerId] = connection;
        return connection;
    }

    useEffect(() => {
        if (!isConnected) {
            connectWebSocket();
        }
    }, [isConnected]);

    // Clean-up
    useEffect(() => {
        const handleBeforeUnload = () => {
            sendSignal({ type: SignalState.LEAVE, sender: userId });
            stompClient.current?.deactivate();
            localStream.current?.getTracks().forEach(track => track.stop());
        };

        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            handleBeforeUnload(); // Also run it when component unmounts
        };
    }, []);

    return {
        isConnected,
        isStreaming,
        startStream,
        remoteStreams,
        activeStreams,
        peers,
        streamers
    };
}