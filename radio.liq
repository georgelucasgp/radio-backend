# Configurações básicas
settings.init.daemon.set(false)
settings.log.stdout.set(true)
settings.log.level.set(3)  # Aumentando o nível de log para depuração
settings.frame.duration.set(0.02)

# Defina o diretório onde suas músicas estão armazenadas
music_dir = "/sound"

# Crie uma playlist com as músicas do diretório
playlist = playlist(
  mode="normal",
  reload=20,
  music_dir
)

# Adicione um fallback para silêncio quando a playlist estiver vazia
# Isso torna a fonte infalível (infallible)
radio = fallback(track_sensitive=false, [
  playlist,
  blank(duration=3.0)  # Silêncio como fallback
])

# Configurar um harbor para receber o stream de voz
# Configuração do harbor para receber o stream de voz
harbor_input = input.harbor(
  "voice.mp3",
  port=8005,
  password=environment.get("ICECAST_SOURCE_PASSWORD"),
  buffer=5.0,
  max=30.0,
  icy=true
)

# Tornar a fonte de voz infalível (para evitar erros quando não há transmissão)
voice = fallback(track_sensitive=false, [
  harbor_input,
  blank(duration=1.0)  # Silêncio como fallback
])

# Detectar quando a voz está ativa (não é silêncio)
# Usamos blank.strip para remover o silêncio e tornar a fonte indisponível quando não há áudio
voice_active = blank.strip(voice, threshold=-40.0, max_blank=1.0)

# Função para diminuir o volume da música quando a voz estiver ativa
def smart_mix(voice, music) =
  # Aplicar volume dinâmico à música baseado na detecção de silêncio
  music_with_volume = amplify(
    # Quando a voz estiver ativa, reduzir o volume da música para 20%
    fun() -> 
      if source.is_ready(voice) then 0.2 else 1.0 end,
    music
  )
  
  # Adicionar as fontes
  add(
    normalize=false,
    [music_with_volume, voice]
  )
end

# Aplicar a mixagem inteligente
mixed = smart_mix(voice_active, radio)

# Saída para Icecast - Stream mixado (música + voz)
output.icecast(
  %mp3(bitrate=128),
  mount=environment.get("ICECAST_MOUNT"),
  host=environment.get("ICECAST_HOST"),
  port=int_of_string(environment.get("ICECAST_PORT")),
  password=environment.get("ICECAST_PASSWORD"),
  name="Radio DoubleG",
  description="Radio Stream powered by DoubleG",
  public=true,
  mixed
) 