## error Diffusion TCP Audio system ## APR2020

- [ ] MaxMSP - develop and export binary <br>
- [ ] maybe(?) port to [openFrameworks](https://openframeworks.cc/documentation/ofxNetwork/ofxTCPClient/) eventually


JACK AUDIO ROUTING SET UP DETAILS
- Install [64bit Jack](https://jackaudio.org/downloads/) for Windows
- Register Jackrouter.dll at command prompt (Ensure "Run as Administrator")
- CMD.exe (open as administrator)
- cd C:\Program Files (x86)\Jack\64bits\
- regsvr32 JackRouter.dll
- "Success" ? if not, do again as admin!
- Run "Jack PortAudio" (window should open, leave open)
- Run "JackControl"
- Select JackRouter as input and output device
- Select number of channels
- Leave JackControl open
- Open DAWs
- Select JackRouter as input and output device (under ASIO)
- Use patchbay to route
- ENJOY ROUTING!

TODO;
- [ ] Document openVPN config/setup
- [ ] Test multiple simultaneous ports for discrete audio channels (acting as S/R buses)
- [ ] Develop bidirectional transport control system
- [ ] Envelope follower for ctrl messages (midiout)
- [ ] MIDI over OSC
- [ ] Clock & CV out/+in
- [ ] GFX processing of audio matrices (GLSL) - export texture from Max for aday


CREATIVE TODO;
- [ ] network error as musical concept
- [ ] minimalism before maximalism - system requires space to breathe
- [ ] divide musical pattern structures
- * one does the downbeats while the other does the offbeat
- * one does the melody other does the harmony etc
- * [hocket](http://www.youtube.com/watch?v=rfco2jnGtn4) ethos
