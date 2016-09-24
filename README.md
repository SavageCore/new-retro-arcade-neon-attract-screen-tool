# New Retro Arcade: Neon Attract Screen Tool

![Preview](http://i.imgur.com/OVdeDxt.png)

### Running from source

`git clone https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool.git`

`cd new-retro-arcade-neon-attract-screen-tool`

`npm install`

`npm start`

### Building

Take a look at [electron-package](https://github.com/electron-userland/electron-packager) if you wish to build it yourself

## Options

#### Render scale

Dimensions for each video in the format of *width*:*height*. Defaults to 256:192 and must be set to 4:3 aspect ratio.

#### Encoder

Specify [FFmpeg][ffmpeglink] encoder to use.

x264 results in the smallest file size but is highly CPU intensive

NVENC uses your [compatible](https://developer.nvidia.com/nvidia-video-codec-sdk#SupportedGPUs) NVIDIA GPU to encode the video. Large file size but low CPU usage.

QuickSync again has a larger file size compared to x264 but by using the integrated GPU on compatible Intel CPUs the load is lessened

#### Hardware Accelerated Decoding

May or may not speed up your rendering times - give it a try!

#### Mute Notification Audio

Mutes all sounds such as the success jingle on render completion

#### Generate FFmpeg report

Will instruct FFmpeg to save a report containing detailed information of the render. If you get any errors rendering please create an [issue] and supply the complete report

#### Enable Extra Cabinet support

This setting renders 35 videos instead of 30 as it is possible to [modify](http://steamcommunity.com/app/465780/discussions/0/343786195673222722/?ctp=3#c343786746013809985) the GameUserSettings file and enable the use of Attract Screens on AimBot cabinets within game.

## Usage

First load it should ask you to set Attract Screen Video which is usually found at `SteamApps\common\New Retro Arcade Neon\NewRetroArcade\Content\Movies\`. This can be any file.

Set any other options you may like then click the top right menu icon and select Main

Click the thumbnail image to assign video to grid or select multiple. It will set the next grid recursively from the grid you began and *overwriting* if they were previously set. For example setting grid 3 to 4 files will result in grids 3, 4, 5 and 6 being set.

**Note** In my test windows 7 virtual machine setting more than 10-15 at once caused errors whereas the actual PC running 10 sets 35 no problems. Let me know in an [issue] if you get this and I will try and fix.

Now hit the play button to render

![Selecting default video](http://i.imgur.com/YQk0Ztu.png) Set grid as default. Any video assigned to this grid will then be used in place of missing videos. Defaults to grid 1

![Start render](http://i.imgur.com/PEMFwWU.png) Start rendering

![Delete video](http://i.imgur.com/5eN698j.png) Remove video from grid. Does not delete your files!

Clicking within the video details pane will play the video. Space will play/pause and Escape will close the video



### License [MIT](LICENSE.md)
[nranlink]: http://digitalcybercherries.com/new-retro-arcade-neon/
[ffmpeglink]: http://ffmpeg.org
[issue]:https://github.com/SavageCore/new-retro-arcade-neon-attract-screen-tool/issues
