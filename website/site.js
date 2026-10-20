// Click-to-load YouTube embed. Without JavaScript the play button is a plain link to the video.
document.querySelectorAll('.video[data-video-id]').forEach((box) => {
  const link = box.querySelector('.video-play')
  if (!link) return

  link.addEventListener('click', (event) => {
    event.preventDefault()

    const frame = document.createElement('iframe')
    frame.src = `https://www.youtube-nocookie.com/embed/${box.dataset.videoId}?autoplay=1&rel=0`
    frame.title = box.dataset.videoTitle || 'Video'
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'
    frame.allowFullscreen = true
    frame.referrerPolicy = 'strict-origin-when-cross-origin'

    box.replaceChildren(frame)
    frame.focus()
  })
})
