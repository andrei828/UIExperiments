
$(function() {
  const { createFFmpeg, fetchFile } = FFmpeg;
  const ffmpeg = createFFmpeg({ log: false });
  ffmpeg.load().then(console.log("loaded ffmpeg.wasm"));
  let currentPart = 1
  let totalParts = 0
  /*
   * type can be one of following:
   *
   * info: internal workflow debug messages
   * fferr: ffmpeg native stderr output
   * ffout: ffmpeg native stdout output
   */
  ffmpeg.setLogger(({ type, message }) => {
    
    if (type == "fferr" && message.includes("Error")) {
      return
    }

    logText.innerHTML = `<b>Part ${currentPart} out of ${totalParts}<b><br><br>`
    logText.innerHTML += message
  });

  /*
   * ratio is a float number between 0 to 1.
   */
  ffmpeg.setProgress(({ ratio }) => {
    if (currentPart === totalParts) {
      console.log(ratio)
    }
    progressBar.ldBar.set(ratio * 100);
  });

  const fileUpload = async ({ target: { files } }) => {
    console.log(files)
    for (const file of files) {
      const videoResource = buildVideoResourceByFile(file, file.name)
      renderResourceBlock(videoResource.videoCore)
      console.log(videoResource)
      window.resources[videoResource.videoCore.id] = videoResource
    }
  }

  const transcode = async (event) => {

    defaultModalContent.style.display = 'none'
    loadingWrapper.classList.remove('loading-wrapper')
    loadingWrapper.classList.add('loading-wrapper-active')
    // await ffmpeg.load();
    const inputPaths = [];
    
    
    totalParts = 0
    let iterator = window.timeline
    while (iterator) {
      totalParts += 1
      iterator = iterator.next
    }
    totalParts += 1

    iterator = window.timeline
    while (iterator) {
        const fileBlob = iterator.data.videoCore.currentSrc
        const fileName = `${iterator.data.videoCore.id}-${iterator.data.metadata.title}`
        const startTime = iterator.data.metadata.startTime
        const endTime = iterator.data.metadata.endTime

        const wi = window.FFMPEG_RESOLUTION_WIDTH
        const he = FFMPEG_RESOLUTION_HEIGHT

        ffmpeg.FS('writeFile', fileName, await fetchFile(fileBlob))
        if (iterator.data.metadata.ratio === 'fit') {
          await ffmpeg.run('-i', fileName, 
            '-vf', `scale='min(${wi},iw)':min'(${he},ih)':force_original_aspect_ratio\=decrease,pad=${wi}:${he}:(ow-iw)/2:(oh-ih)/2`, 
            '-ss', `${startTime}`, '-to', `${endTime}`, 'tmp.mp4'
          )
        } else if (iterator.data.metadata.ratio === 'strech') {
          await ffmpeg.run('-i', fileName, '-vf', `scale=${wi}:${he}`, '-ss', `${startTime}`, '-to', `${endTime}`, 'tmp.mp4');
        }
        console.log(fileName, startTime, endTime)
        const data = ffmpeg.FS('readFile', 'tmp.mp4')
        ffmpeg.FS('writeFile', fileName, await fetchFile(
            new Blob([data.buffer], {
              type: "video/mp4"
            })
          ))
        
        currentPart += 1 
        inputPaths.push(`file ${fileName}`);

        iterator = iterator.next
    }
    ffmpeg.FS('writeFile', 'concat_list.txt', inputPaths.join('\n'));
    await ffmpeg.run('-f', 'concat', '-safe', '0', '-i', 'concat_list.txt', 'output.mp4');

    const data = ffmpeg.FS('readFile', 'output.mp4');
    var urlCreator = window.URL || window.webkitURL;
    var imageUrl = urlCreator.createObjectURL(
      new Blob([data.buffer], {
        type: "video/mp4"
      })
    );

    var tag = document.createElement('a');
    tag.href = imageUrl;
    tag.target = '_blank';
    tag.download = 'sample.mp4';
    document.body.appendChild(tag);
    tag.click();
    document.body.removeChild(tag);
    delete ffmpeg;
    // const data = ffmpeg.FS('readFile', 'output.mp4');
    // const video = document.getElementById("output-video");
    // video.src = URL.createObjectURL(
    //   new Blob([data.buffer], {
    //     type: "video/mp4"
    //   })
    // );
    
  //   for (const file of files) {
  //     const { name } = file;
  //     ffmpeg.FS('writeFile', name, await fetchFile(file));
  //     inputPaths.push(`file ${name}`);
  //   }
    // ffmpeg.FS('writeFile', 'concat_list.txt', inputPaths.join('\n'));
    // await ffmpeg.run('-f', 'concat', '-safe', '0', '-i', 'concat_list.txt', 'output.mp4');
    // message.innerHTML = "Complete Concating";
    // const data = ffmpeg.FS('readFile', 'output.mp4');
    // const video = document.getElementById("output-video");
    // video.src = URL.createObjectURL(
    //   new Blob([data.buffer], {
    //     type: "video/mp4"
    //   })
    // );
  };
  const uploader = document.getElementById("uploader");
  uploader.addEventListener("change", fileUpload);

  const elm = document.getElementById("start-render");
  elm.addEventListener("click", transcode);
})