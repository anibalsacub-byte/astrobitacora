import { jsPDF } from 'jspdf'

async function svgToCanvas(svg: SVGSVGElement, scale = 3): Promise<HTMLCanvasElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const vb = svg.viewBox.baseVal
  clone.setAttribute('width', String(vb.width))
  clone.setAttribute('height', String(vb.height))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  const xml = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('No se pudo rasterizar la carta'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = vb.width * scale
    canvas.height = vb.height * scale
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fbf7ee'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

function download(href: string, filename: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  a.click()
}

export async function exportPng(svg: SVGSVGElement, filename: string) {
  const canvas = await svgToCanvas(svg)
  download(canvas.toDataURL('image/png'), `${filename}.png`)
}

export function exportSvg(svg: SVGSVGElement, filename: string) {
  const xml = new XMLSerializer().serializeToString(svg)
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
  download(url, `${filename}.svg`)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportPdf(svg: SVGSVGElement, filename: string) {
  const canvas = await svgToCanvas(svg)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pw = pdf.internal.pageSize.getWidth()
  const ph = pdf.internal.pageSize.getHeight()
  const margin = 36
  const ratio = canvas.height / canvas.width
  let w = pw - margin * 2
  let h = w * ratio
  if (h > ph - margin * 2) {
    h = ph - margin * 2
    w = h / ratio
  }
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pw - w) / 2, margin, w, h)
  pdf.save(`${filename}.pdf`)
}
