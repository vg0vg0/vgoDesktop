# VGoDesktop

<p>Based on <a href="https://github.com/webtorrent/webtorrent-desktop">webtorrent</a> and blockchain, VGo apps is designed to encourage people to share resources on internet.</p>
<p>VGo blockchain which has a total of 1B VGo coins cointains the digest,the timestamp ,the signature of owner and the price(VGo coin) for every resouce.</p>
<p>eache resource has a price(VGo coin) set by owner, if the price > 0, other peer need to pay VGo coins to the owner to download the full file.(the first part(10%) is always free for preview).</p>


### Get the code

```
$ git clone https://github.com/vg0vg0/vgoDesktop.git
$ cd vgoDesktop
$ npm install
```

### Run the app

```
$ npm start
```
### Package the app

Builds app binaries for Mac, Linux, and Windows.

```
$ npm run package
```

To build for one platform:

```
$ npm run package -- [platform] [options]
```

Where `[platform]` is `darwin`, `linux`, `win32`, or `all` (default).

The following optional arguments are available:

- `--sign` - Sign the application (Mac, Windows)
- `--package=[type]` - Package single output type.
   - `deb` - Debian package
   - `zip` - Linux zip file
   - `dmg` - Mac disk image
   - `exe` - Windows installer
   - `portable` - Windows portable app
   - `all` - All platforms (default)
   
```
   
eg. npm run package -- win32 --package=portable   
```
Note: Even with the `--package` option, the auto-update files (.nupkg for Windows,
-darwin.zip for Mac) will always be produced.

<a href="https://github.com/vg0vg0/vgoBinary/blob/master/desktop/VGo-win32-x64.zip?raw=true">Download windows x64</a>

<img src="https://raw.githubusercontent.com/vg0vg0/vgoDesktop/master/screenshot/1.jpg" height='350' width='650'/>
<img src="https://raw.githubusercontent.com/vg0vg0/vgoDesktop/master/screenshot/2.jpg" height='350' width='650'/>
<img src="https://raw.githubusercontent.com/vg0vg0/vgoDesktop/master/screenshot/3.jpg" height='350' width='650'/>
<img src="https://raw.githubusercontent.com/vg0vg0/vgoDesktop/master/screenshot/4.jpg" height='350' width='650'/>
<img src="https://raw.githubusercontent.com/vg0vg0/vgoDesktop/master/screenshot/5.jpg" height='350' width='650'/>
<img src="https://raw.githubusercontent.com/vg0vg0/vgoDesktop/master/screenshot/6.jpg" height='350' width='650'/>
<img src="https://raw.githubusercontent.com/vg0vg0/vgoDesktop/master/screenshot/7.jpg" height='350' width='650'/>
<img src="https://raw.githubusercontent.com/vg0vg0/vgoDesktop/master/screenshot/8.jpg" height='350' width='650'/>