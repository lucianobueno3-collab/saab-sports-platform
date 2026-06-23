'use client'

import { useState, useRef } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { Upload, FileText, CheckCircle, AlertCircle, X, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type FileStatus = 'idle' | 'parsing' | 'success' | 'error'

interface UploadedFile {
  id: string
  name: string
  size: string
  type: 'fit' | 'csv'
  status: FileStatus
  result?: string
  error?: string
}

export default function ImportPage() {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(raw: FileList | null) {
    if (!raw) return
    const newFiles: UploadedFile[] = Array.from(raw).map((f) => ({
      id: Math.random().toString(36).slice(2),
      name: f.name,
      size: `${(f.size / 1024).toFixed(1)} KB`,
      type: f.name.endsWith('.fit') ? 'fit' : 'csv',
      status: 'parsing',
    }))
    setFiles((prev) => [...prev, ...newFiles])

    // Simulate parse
    newFiles.forEach((nf) => {
      setTimeout(() => {
        setFiles((prev) => prev.map((f) =>
          f.id === nf.id
            ? { ...f, status: 'success', result: 'Atividade importada · TSS: 98 · CTL atualizado' }
            : f
        ))
      }, 1200 + Math.random() * 800)
    })
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  return (
    <div>
      <Topbar title="Importar Dados" subtitle="Arquivos .FIT e .CSV do TrainingPeaks" />

      <div className="p-6 space-y-6">
        {/* Info */}
        <div className="flex items-start gap-3 p-4 bg-[#0088ff]/10 border border-[#0088ff]/20 rounded-xl">
          <Info className="w-4 h-4 text-[#0088ff] mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-[#0088ff] mb-0.5">Como importar do TrainingPeaks</p>
            <p className="text-muted-foreground text-xs">
              No TrainingPeaks: vá em <strong>Calendário → selecione a atividade → Exportar → .FIT</strong>. Para exportar múltiplas, use o relatório CSV em <strong>Settings → Export</strong>.
            </p>
          </div>
        </div>

        {/* Drop zone */}
        <div
          className={cn(
            'border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer',
            dragging ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50 hover:bg-secondary/30'
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Arraste arquivos aqui ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">Suporte: <strong>.FIT</strong> (Garmin, Wahoo, Polar) e <strong>.CSV</strong> (TrainingPeaks export)</p>
            </div>
          </div>
          <input
            ref={inputRef} type="file" multiple accept=".fit,.csv" className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-secondary/30">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {files.length} arquivo{files.length > 1 ? 's' : ''} selecionado{files.length > 1 ? 's' : ''}
              </p>
            </div>
            <div className="divide-y divide-border/50">
              {files.map((f) => (
                <div key={f.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    f.type === 'fit' ? 'bg-[#0088ff]/10' : 'bg-[#00d084]/10'
                  )}>
                    <FileText className={cn('w-4 h-4', f.type === 'fit' ? 'text-[#0088ff]' : 'text-[#00d084]')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{f.size} · {f.type.toUpperCase()}</p>
                    {f.result && <p className="text-xs text-[#00d084] mt-0.5">{f.result}</p>}
                    {f.error && <p className="text-xs text-primary mt-0.5">{f.error}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    {f.status === 'parsing' && (
                      <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    )}
                    {f.status === 'success' && <CheckCircle className="w-4 h-4 text-[#00d084]" />}
                    {f.status === 'error' && <AlertCircle className="w-4 h-4 text-primary" />}
                    <button onClick={() => removeFile(f.id)} className="p-1 hover:bg-secondary rounded transition-colors">
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {files.some((f) => f.status === 'success') && (
              <div className="px-5 py-3 border-t border-border bg-secondary/30 flex justify-end">
                <button className="px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors">
                  Salvar e Recalcular PMC
                </button>
              </div>
            )}
          </div>
        )}

        {/* Formats table */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">Campos Importados por Formato</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <p className="font-semibold text-[#0088ff] mb-2">.FIT (Arquivo de Atividade)</p>
              <ul className="space-y-1 text-muted-foreground">
                {['Data e hora', 'Duração e distância', 'Potência média e NP', 'FC média e máxima', 'Cadência', 'Elevação', 'Registros lap a lap', 'TSS calculado (se FTP configurado)'].map(i => (
                  <li key={i} className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-[#0088ff]" />{i}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-[#00d084] mb-2">.CSV (TrainingPeaks Export)</p>
              <ul className="space-y-1 text-muted-foreground">
                {['Data, título, modalidade', 'TSS, IF, NP (direto do TP)', 'FC média', 'Potência média', 'Duração e distância', 'Calorias', 'Importação em lote (múltiplas semanas)', 'Atualização do PMC histórico'].map(i => (
                  <li key={i} className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-[#00d084]" />{i}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
