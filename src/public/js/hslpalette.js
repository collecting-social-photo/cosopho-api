// eslint-disable-next-line
class palette {
  hsv2rgb(hue, saturation, value) {
    let chroma = value * saturation
    let hue1 = hue / 60
    let x = chroma * (1 - Math.abs((hue1 % 2) - 1))
    let r1
    let g1
    let b1
    if (hue1 >= 0 && hue1 <= 1) {
      ([r1, g1, b1] = [chroma, x, 0])
    } else if (hue1 >= 1 && hue1 <= 2) {
      ([r1, g1, b1] = [x, chroma, 0])
    } else if (hue1 >= 2 && hue1 <= 3) {
      ([r1, g1, b1] = [0, chroma, x])
    } else if (hue1 >= 3 && hue1 <= 4) {
      ([r1, g1, b1] = [0, x, chroma])
    } else if (hue1 >= 4 && hue1 <= 5) {
      ([r1, g1, b1] = [x, 0, chroma])
    } else if (hue1 >= 5 && hue1 <= 6) {
      ([r1, g1, b1] = [chroma, 0, x])
    }

    let m = value - chroma
    let [r, g, b] = [r1 + m, g1 + m, b1 + m]

    // Change r,g,b values from [0,1] to [0,255]
    return [255 * r, 255 * g, 255 * b]
  }

  draw(picked) {
    console.log('Drawing palette')
    var c = document.getElementById('palette_canvas')
    var ctx = c.getContext('2d')
    for (let y of [...Array(c.height).keys()]) {
      for (let x of [...Array(c.width).keys()]) {
        let rgb = [0, 0, 0]
        if (y < 100) {
          rgb = this.hsv2rgb(x, (y / 100), 1)
        } else {
          rgb = this.hsv2rgb(x, 1, 1 - ((y - 100) / 100))
        }
        ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
        ctx.fillRect(x, y, 1, 1)
      }
    }

    //  Draw the range on, if we've picked a point
    if (picked) {
      ctx.beginPath()
      ctx.arc(picked.x, 200 - picked.y, 30, 0, 2 * Math.PI)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(picked.x + 360, 200 - picked.y, 30, 0, 2 * Math.PI)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(picked.x - 360, 200 - picked.y, 30, 0, 2 * Math.PI)
      ctx.stroke()
    }

    document.getElementById('palette_canvas').addEventListener('click', (evt) => {
      const pc = document.getElementById('palette_canvas')
      const h = parseInt(evt.offsetX / pc.offsetWidth * 360, 10)
      const y = evt.offsetY / pc.offsetHeight * 200
      let l = 1 - (y / 200)
      document.location = `/explore-o-matic/colour/${h},100,${parseInt(l * 100, 10)}`
    })
  }
}