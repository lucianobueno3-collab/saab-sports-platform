import { describe, it, expect } from 'vitest'
import { filtrarAlunos } from './busca-aluno'

const a = (full_name: string) => ({ id: full_name, full_name, primary_sport: 'running' })
const EQUIPE = [
  a('Ana Prado'), a('José Meireles'), a('Bruno Salles'),
  a('Maria da Conceição'), a('bruna souza'),
]

describe('busca por aluno', () => {
  it('acha pelo começo do nome', () => {
    expect(filtrarAlunos(EQUIPE, 'ana').map(x => x.full_name)).toEqual(['Ana Prado'])
  })

  it('acha pelo sobrenome', () => {
    expect(filtrarAlunos(EQUIPE, 'salles').map(x => x.full_name)).toEqual(['Bruno Salles'])
  })

  it('ignora acento nos dois sentidos', () => {
    // Ninguém digita acento com pressa no celular.
    expect(filtrarAlunos(EQUIPE, 'jose').map(x => x.full_name)).toEqual(['José Meireles'])
    expect(filtrarAlunos(EQUIPE, 'conceicao').map(x => x.full_name)).toEqual(['Maria da Conceição'])
    expect(filtrarAlunos([a('Jose Silva')], 'josé').map(x => x.full_name)).toEqual(['Jose Silva'])
  })

  it('ignora maiúsculas', () => {
    expect(filtrarAlunos(EQUIPE, 'BRUNO').map(x => x.full_name)).toEqual(['Bruno Salles'])
  })

  it('traz todos os parecidos', () => {
    expect(filtrarAlunos(EQUIPE, 'brun').map(x => x.full_name)).toEqual(['Bruno Salles', 'bruna souza'])
  })

  it('busca vazia não devolve nada — a lista só abre ao digitar', () => {
    expect(filtrarAlunos(EQUIPE, '')).toEqual([])
    expect(filtrarAlunos(EQUIPE, '   ')).toEqual([])
  })

  it('nome que não existe devolve lista vazia', () => {
    expect(filtrarAlunos(EQUIPE, 'zoraide')).toEqual([])
  })

  it('corta em 8 para a lista não cobrir a tela', () => {
    const muitos = Array.from({ length: 30 }, (_, i) => a(`Aluno ${i}`))
    expect(filtrarAlunos(muitos, 'aluno')).toHaveLength(8)
  })

  it('espaço em volta do termo não atrapalha', () => {
    expect(filtrarAlunos(EQUIPE, '  ana  ').map(x => x.full_name)).toEqual(['Ana Prado'])
  })
})
