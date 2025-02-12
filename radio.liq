# Configurações básicas
settings.init.daemon.set(false)
settings.log.stdout.set(true)
settings.log.level.set(3)

# Defina o diretório onde suas músicas estão armazenadas
music_dir = "/sound"

# Crie uma playlist com as músicas do diretório
playlist = playlist(
  mode="normal",
  reload=20,
  music_dir
)

# Fallback para silêncio se não houver música
radio = fallback([playlist])

# Input para o stream de voz (recebe do FFmpeg)
harbor_password = environment.get("ICECAST_SOURCE_PASSWORD")

# Configuração do input harbor com fallback para silêncio
voice = fallback(track_sensitive=false,
  [
    input.harbor(
      "voice",
      id="voice",
      port=8005,
      user="source",
      password=harbor_password,
      buffer=0.5,
      max=10.0,
      on_connect=fun(_) -> log("Conexão de voz recebida"),
      on_disconnect=fun() -> log("Conexão de voz finalizada")
    ),
    blank()
  ]
)

# Mixagem de voz com música
# A voz terá volume um pouco mais alto que a música quando estiver presente
mixed = add([
  # Música com volume reduzido quando há voz
  smooth_add(
    duration=0.3,
    p=0.3,
    normal=radio,
    special=voice
  ),
  # Voz sempre em volume normal
  voice
])

# Saída para Icecast - Stream único com música e voz mixados
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

# Saída para Icecast - Stream de voz separado com alta qualidade
output.icecast(
  %mp3(bitrate=128),
  mount=environment.get("ICECAST_VOICE_MOUNT"),
  host=environment.get("ICECAST_HOST"),
  port=int_of_string(environment.get("ICECAST_PORT")),
  password=environment.get("ICECAST_PASSWORD"),
  name="Radio DoubleG - Voice",
  description="Voice Stream powered by DoubleG",
  public=true,
  voice
) 