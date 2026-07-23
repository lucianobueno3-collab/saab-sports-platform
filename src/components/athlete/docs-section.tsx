'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAthleteDocuments, extractPdfViaServer, type AthleteDocumentRow } from '@/lib/supabase/queries'
import { extractPdfText, ocrPdf, hasExtractableText } from '@/lib/parsers/pdf-parser'
import { FileText, Upload, Download, X, Loader2, Sparkles, ScanText } from 'lucide-react'

interface Props {
  athleteId: string
  area: 'saude' | 'nutricao'
  /** Chamado com o texto extraído do PDF quando o usuário clica em "Preencher com base no PDF" */
  onExtractText: (text: string, fileName: string) => void
  /** Rótulo do botão de extração, ex: "Detectar exames" */
  extractLabel: string
}

export function DocsSection({ athleteId, area, onExtractText, extractLabel }: Props) {
  const [docs, setDocs] = useState<AthleteDocumentRow[]>([])
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState<string | null>(null)
  const [ocrDoc, setOcrDoc] = useState<AthleteDocumentRow | null>(null)
  const [ocrProgress, setOcrProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [athleteId, area]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setDocs(await getAthleteDocuments(athleteId, area))
  }

  async function handleUpload(file: File) {
    if (file.type !== 'application/pdf') { setError('Apenas arquivos PDF.'); return }
    if (file.size > 20 * 1024 * 1024) { setError('Arquivo muito grande (máx. 20 MB).'); return }
    setError(null)
    setUploading(true)
    const sb = createClient()
    const path = `${athleteId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, '_')}`
    const { error: upErr } = await sb.storage.from('athlete-docs').upload(path, file, { contentType: 'application/pdf' })
    if (upErr) {
      setError(`Falha no upload: ${upErr.message}`)
      setUploading(false)
      return
    }
    const { error: dbErr } = await sb.from('athlete_documents').insert({
      athlete_id: athleteId, area, file_name: file.name, storage_path: path,
    })
    if (dbErr) setError(`Falha ao registrar: ${dbErr.message}`)
    setUploading(false)
    load()
  }

  async function handleDownload(doc: AthleteDocumentRow) {
    const sb = createClient()
    const { data, error: err } = await sb.storage.from('athlete-docs').createSignedUrl(doc.storage_path, 300)
    if (err || !data) { setError('Não foi possível gerar o link.'); return }
    window.open(data.signedUrl, '_blank')
  }

  async function handleDelete(doc: AthleteDocumentRow) {
    if (!window.confirm(`Excluir "${doc.file_name}" permanentemente?`)) return
    const sb = createClient()
    await sb.storage.from('athlete-docs').remove([doc.storage_path])
    await sb.from('athlete_documents').delete().eq('id', doc.id)
    load()
  }

  async function handleExtract(doc: AthleteDocumentRow) {
    setError(null)
    setExtracting(doc.id)
    try {
      // 1) Servidor (Node) — robusto em qualquer navegador.
      const srv = await extractPdfViaServer(doc.storage_path)
      if (srv.ok) {
        if (srv.text && hasExtractableText(srv.text)) { onExtractText(srv.text, doc.file_name) }
        else { setOcrDoc(doc) } // PDF sem camada de texto (digitalizado) → OCR
        setExtracting(null)
        return
      }

      // 2) Fallback: leitura no navegador (pdfjs) caso o servidor falhe.
      const sb = createClient()
      const { data, error: dlErr } = await sb.storage.from('athlete-docs').download(doc.storage_path)
      if (dlErr || !data) throw new Error(dlErr?.message ?? 'download falhou')
      const file = new File([data], doc.file_name, { type: 'application/pdf' })
      const text = await extractPdfText(file)
      if (!hasExtractableText(text)) setOcrDoc(doc)
      else onExtractText(text, doc.file_name)
    } catch (e) {
      setError(`Falha ao ler o PDF: ${e instanceof Error ? e.message : String(e)}`)
    }
    setExtracting(null)
  }

  async function runOcr(doc: AthleteDocumentRow) {
    setError(null)
    setOcrProgress('Preparando OCR...')
    try {
      const sb = createClient()
      const { data, error: dlErr } = await sb.storage.from('athlete-docs').download(doc.storage_path)
      if (dlErr || !data) throw new Error(dlErr?.message ?? 'download falhou')
      const file = new File([data], doc.file_name, { type: 'application/pdf' })
      const text = await ocrPdf(file, ({ page, totalPages, status }) =>
        setOcrProgress(page > 0 ? `Página ${page}/${totalPages} — ${status}` : status))
      setOcrProgress(null)
      setOcrDoc(null)
      if (!hasExtractableText(text)) {
        setError('O OCR não conseguiu reconhecer texto neste PDF. Preencha manualmente.')
      } else {
        onExtractText(text, doc.file_name)
      }
    } catch (e) {
      setOcrProgress(null)
      setError(`Falha no OCR: ${String(e)}`)
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">Documentos (PDF)</h3>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
          style={{ background: '#94a3b815', border: '1px solid #94a3b840', color: '#94a3b8' }}
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          {uploading ? 'Enviando...' : 'Anexar PDF'}
        </button>
        <input
          ref={inputRef} type="file" accept="application/pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }}
        />
      </div>

      {error && (
        <p className="text-[11px] text-[#ef4444] px-5 py-2 border-b border-border/30">{error}</p>
      )}

      {/* Prompt de OCR para PDF escaneado */}
      {ocrDoc && (
        <div className="px-5 py-3 border-b border-border/30" style={{ background: '#a78bfa14' }}>
          {ocrProgress ? (
            <div className="flex items-center gap-2 text-[11px] text-[#a78bfa]">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Reconhecendo texto — {ocrProgress}. Isso pode levar até 1 min por página.</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-[11px] text-muted-foreground flex-1 min-w-[200px]">
                <span className="font-semibold text-foreground">{ocrDoc.file_name}</span> parece ser digitalizado (sem texto). Rodar OCR para tentar ler? É mais lento e roda no seu navegador.
              </p>
              <button onClick={() => runOcr(ocrDoc)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors"
                style={{ background: '#a78bfa22', border: '1px solid #a78bfa55', color: '#a78bfa' }}>
                <ScanText className="w-3.5 h-3.5" /> Rodar OCR
              </button>
              <button onClick={() => setOcrDoc(null)}
                className="px-3 py-1.5 text-xs text-muted-foreground rounded-lg hover:bg-secondary">
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {docs.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          Nenhum documento — anexe laudos e relatórios em PDF
        </p>
      ) : (
        <div className="divide-y divide-border/40">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 px-5 py-3">
              <FileText className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{doc.file_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(doc.uploaded_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
              <button
                onClick={() => handleExtract(doc)}
                disabled={extracting !== null}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                style={{ background: '#a78bfa15', border: '1px solid #a78bfa40', color: '#a78bfa' }}
                title="Ler o PDF e preencher o formulário automaticamente"
              >
                {extracting === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {extractLabel}
              </button>
              <button onClick={() => handleDownload(doc)} className="p-1.5 rounded hover:bg-secondary transition-colors" title="Baixar">
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button onClick={() => handleDelete(doc)} className="p-1.5 rounded hover:bg-secondary transition-colors" title="Excluir">
                <X className="w-3.5 h-3.5 text-muted-foreground/50" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
