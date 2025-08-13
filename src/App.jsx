"use client"

import { useState, useEffect, useCallback } from "react"
import * as Paho from "paho-mqtt"
import "./assets/bootstrap-styles.css"

const App = () => {
  // Estados de conexão MQTT
  const [mqttClient, setMqttClient] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("Desconectado")

  // Estados dos sensores
  const [sensorData, setSensorData] = useState({
    temperatura: "--",
    umidade: "--",
    movimento: false,
    lastUpdate: null,
  })

  // Estados dos dispositivos - Garagem
  const [garagemDevices, setGaragemDevices] = useState({
    portaoSocial: { status: "fechado", loading: false },
    portaoBasculante: { status: "fechado", loading: false },
    luzGaragem: { status: "desligada", loading: false },
  })

  // Estados dos dispositivos - Sala
  const [salaDevices, setSalaDevices] = useState({
    luzSala: { status: "desligada", loading: false },
    arCondicionado: { status: "desligado", loading: false },
    umidificador: { status: "desligado", loading: false },
  })

  // Estados dos dispositivos - Quarto
  const [quartoDevices, setQuartoDevices] = useState({
    luzQuarto: { status: "desligada", loading: false },
    tomadaInteligente: { status: "desligada", loading: false },
    cortina: { status: "fechada", loading: false },
  })

  // Estados do tema e logs
  const [theme, setTheme] = useState("light")
  const [messageLog, setMessageLog] = useState([])

  // Configuração do tema automático
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    setTheme(mediaQuery.matches ? "dark" : "light")

    const handleChange = (e) => setTheme(e.matches ? "dark" : "light")
    mediaQuery.addEventListener("change", handleChange)

    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", theme)
  }, [theme])

  // Função para adicionar log
  const addLog = useCallback((message, type = "info") => {
    const timestamp = new Date().toLocaleTimeString()
    setMessageLog((prev) => [
      {
        id: Date.now(),
        timestamp,
        message,
        type,
      },
      ...prev.slice(0, 49),
    ]) // Manter apenas 50 mensagens
  }, [])

  // Conexão MQTT
  const connectMQTT = useCallback(() => {
    try {
      const clientId = `dashboard_${Math.random().toString(36).substr(2, 9)}`
      const client = new Paho.Client("broker.hivemq.com", 8000, clientId)

      client.onConnectionLost = (responseObject) => {
        if (responseObject.errorCode !== 0) {
          setIsConnected(false)
          setConnectionStatus("Conexão perdida")
          addLog(`Conexão perdida: ${responseObject.errorMessage}`, "error")
        }
      }

      client.onMessageArrived = (message) => {
        const topic = message.destinationName
        const payload = message.payloadString

        addLog(`📥 [${topic}]: ${payload}`, "received")
        handleIncomingMessage(topic, payload)
      }

      client.connect({
        onSuccess: () => {
          setIsConnected(true)
          setConnectionStatus("Conectado")
          setMqttClient(client)
          addLog("✅ Conectado ao broker MQTT", "success")

          const topics = [
            "casa/sala/dados",
            "casa/sala/ar",
            "casa/sala/umidificador",
            "casa/garagem/status",
            "casa/quarto/luz",
            "casa/quarto/tomada",
            "casa/quarto/cortina",
          ]

          topics.forEach((topic) => {
            client.subscribe(topic)
            addLog(`📡 Subscrito ao tópico: ${topic}`, "info")
          })
        },
        onFailure: (error) => {
          setIsConnected(false)
          setConnectionStatus("Falha na conexão")
          addLog(`❌ Erro na conexão: ${error.errorMessage}`, "error")
        },
      })
    } catch (error) {
      addLog(`❌ Erro ao conectar: ${error.message}`, "error")
    }
  }, [addLog])

  // Desconexão MQTT
  const disconnectMQTT = useCallback(() => {
    if (mqttClient && isConnected) {
      mqttClient.disconnect()
      setIsConnected(false)
      setConnectionStatus("Desconectado")
      setMqttClient(null)
      addLog("🔌 Desconectado do broker MQTT", "info")
    }
  }, [mqttClient, isConnected, addLog])

  const handleIncomingMessage = useCallback(
    (topic, payload) => {
      try {
        if (topic === "casa/sala/dados") {
          // Formato: "Temp: 25.5C, Umid: 60%"
          const tempMatch = payload.match(/Temp: ([\d.]+)C/)
          const umidMatch = payload.match(/Umid: ([\d.]+)%/)

          if (tempMatch && umidMatch) {
            setSensorData((prev) => ({
              ...prev,
              temperatura: tempMatch[1],
              umidade: umidMatch[1],
              lastUpdate: new Date(),
            }))
          }
        } else if (topic === "casa/sala/ar") {
          const status = payload === "ON" ? "ligado" : "desligado"
          setSalaDevices((prev) => ({
            ...prev,
            arCondicionado: { ...prev.arCondicionado, status, loading: false },
          }))
        } else if (topic === "casa/sala/umidificador") {
          const status = payload === "ON" ? "ligado" : "desligado"
          setSalaDevices((prev) => ({
            ...prev,
            umidificador: { ...prev.umidificador, status, loading: false },
          }))
        } else if (topic === "casa/garagem/status") {
          if (payload === "social_aberto") {
            setGaragemDevices((prev) => ({
              ...prev,
              portaoSocial: { ...prev.portaoSocial, status: "aberto", loading: false },
            }))
          } else if (payload === "social_fechado") {
            setGaragemDevices((prev) => ({
              ...prev,
              portaoSocial: { ...prev.portaoSocial, status: "fechado", loading: false },
            }))
          } else if (payload === "basculante_aberto") {
            setGaragemDevices((prev) => ({
              ...prev,
              portaoBasculante: { ...prev.portaoBasculante, status: "aberto", loading: false },
            }))
          } else if (payload === "basculante_fechado") {
            setGaragemDevices((prev) => ({
              ...prev,
              portaoBasculante: { ...prev.portaoBasculante, status: "fechado", loading: false },
            }))
          } else if (payload === "movimento_detectado") {
            setSensorData((prev) => ({
              ...prev,
              movimento: true,
            }))
            setGaragemDevices((prev) => ({
              ...prev,
              luzGaragem: { ...prev.luzGaragem, status: "ligada", loading: false },
            }))
          } else if (payload === "luz_desligada") {
            setSensorData((prev) => ({
              ...prev,
              movimento: false,
            }))
            setGaragemDevices((prev) => ({
              ...prev,
              luzGaragem: { ...prev.luzGaragem, status: "desligada", loading: false },
            }))
          }
        }
      } catch (error) {
        addLog(`❌ Erro ao processar mensagem: ${error.message}`, "error")
      }
    },
    [addLog],
  )

  // Enviar comando MQTT
  const sendMQTTCommand = useCallback(
    (topic, command, deviceSetter, deviceKey) => {
      if (!mqttClient || !isConnected) {
        addLog("❌ MQTT não conectado", "error")
        return
      }

      try {
        // Definir loading
        if (deviceSetter && deviceKey) {
          deviceSetter((prev) => ({
            ...prev,
            [deviceKey]: { ...prev[deviceKey], loading: true },
          }))
        }

        const message = new Paho.Message(command)
        message.destinationName = topic
        mqttClient.send(message)

        addLog(`📤 [${topic}]: ${command}`, "sent")

        // Remover loading após timeout
        setTimeout(() => {
          if (deviceSetter && deviceKey) {
            deviceSetter((prev) => ({
              ...prev,
              [deviceKey]: { ...prev[deviceKey], loading: false },
            }))
          }
        }, 2000)
      } catch (error) {
        addLog(`❌ Erro ao enviar comando: ${error.message}`, "error")
        if (deviceSetter && deviceKey) {
          deviceSetter((prev) => ({
            ...prev,
            [deviceKey]: { ...prev[deviceKey], loading: false },
          }))
        }
      }
    },
    [mqttClient, isConnected, addLog],
  )

  // Componente de controle de dispositivo
  const DeviceControl = ({ title, status, onCommand, loading, type = "toggle" }) => {
    const getStatusColor = () => {
      if (loading) return "warning"
      switch (status) {
        case "ligada":
        case "ligado":
        case "aberto":
        case "aberta":
          return "success"
        default:
          return "secondary"
      }
    }

    const getStatusText = () => {
      if (loading) return "Processando..."
      return status.charAt(0).toUpperCase() + status.slice(1)
    }

    return (
      <div className="card device-card h-100">
        <div className="card-body text-center">
          <h6 className="card-title">{title}</h6>
          <div className={`badge bg-${getStatusColor()} mb-3`}>{getStatusText()}</div>
          <div className="d-grid gap-2">
            {type === "toggle" ? (
              <>
                <button className="btn btn-success btn-sm" onClick={() => onCommand("ON")} disabled={loading}>
                  {loading ? "⏳" : "🟢"} Ligar
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => onCommand("OFF")} disabled={loading}>
                  {loading ? "⏳" : "🔴"} Desligar
                </button>
              </>
            ) : type === "door" ? (
              <>
                <button className="btn btn-primary btn-sm" onClick={() => onCommand("abrir")} disabled={loading}>
                  {loading ? "⏳" : "🔓"} Abrir
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => onCommand("fechar")} disabled={loading}>
                  {loading ? "⏳" : "🔒"} Fechar
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary btn-sm" onClick={() => onCommand("ABRIR")} disabled={loading}>
                  {loading ? "⏳" : "📖"} Abrir
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => onCommand("FECHAR")} disabled={loading}>
                  {loading ? "⏳" : "📕"} Fechar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-vh-100 ${theme === "dark" ? "bg-dark text-light" : "bg-light"}`}>
      {/* Header */}
      <nav className="navbar navbar-expand-lg navbar-dark bg-primary">
        <div className="container">
          <span className="navbar-brand">🏠 ESP32 Casa Inteligente</span>
          <div className="d-flex align-items-center">
            <button
              className="btn btn-outline-light me-3"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? "🌙" : "☀️"}
            </button>
            <span className="navbar-text me-3">
              <span className={`status-indicator ${isConnected ? "status-connected" : "status-disconnected"}`}></span>
              {connectionStatus}
            </span>
          </div>
        </div>
      </nav>

      <div className="container py-4">
        {/* Controles de Conexão */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">🔌 Conexão MQTT</h5>
                <div className="d-flex gap-2">
                  <button className="btn btn-success" onClick={connectMQTT} disabled={isConnected}>
                    Conectar
                  </button>
                  <button className="btn btn-danger" onClick={disconnectMQTT} disabled={!isConnected}>
                    Desconectar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sensores */}
        <div className="row mb-4">
          <div className="col-12">
            <h4>📊 Sensores DHT22 + PIR</h4>
          </div>
          <div className="col-md-3 mb-3">
            <div className="card text-center">
              <div className="card-body">
                <h6 className="card-title">🌡️ Temperatura</h6>
                <p className="sensor-value text-danger">{sensorData.temperatura}°C</p>
              </div>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <div className="card text-center">
              <div className="card-body">
                <h6 className="card-title">💧 Umidade</h6>
                <p className="sensor-value text-info">{sensorData.umidade}%</p>
              </div>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <div className="card text-center">
              <div className="card-body">
                <h6 className="card-title">🚶 Movimento PIR</h6>
                <p className={`sensor-value ${sensorData.movimento ? "text-warning" : "text-secondary"}`}>
                  {sensorData.movimento ? "Detectado" : "Ausente"}
                </p>
              </div>
            </div>
          </div>
          <div className="col-md-3 mb-3">
            <div className="card text-center">
              <div className="card-body">
                <h6 className="card-title">⏰ Última Atualização</h6>
                <p className="sensor-value text-muted">
                  {sensorData.lastUpdate ? sensorData.lastUpdate.toLocaleTimeString() : "--:--"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Garagem */}
        <div className="row mb-4">
          <div className="col-12">
            <h4>🚗 Garagem (Servos + PIR)</h4>
          </div>
          <div className="col-md-4 mb-3">
            <DeviceControl
              title="🚪 Portão Social"
              status={garagemDevices.portaoSocial.status}
              loading={garagemDevices.portaoSocial.loading}
              type="door"
              onCommand={(cmd) => sendMQTTCommand("casa/garagem/social", cmd, setGaragemDevices, "portaoSocial")}
            />
          </div>
          <div className="col-md-4 mb-3">
            <DeviceControl
              title="🏠 Portão Basculante"
              status={garagemDevices.portaoBasculante.status}
              loading={garagemDevices.portaoBasculante.loading}
              type="door"
              onCommand={(cmd) =>
                sendMQTTCommand("casa/garagem/basculante", cmd, setGaragemDevices, "portaoBasculante")
              }
            />
          </div>
          <div className="col-md-4 mb-3">
            <DeviceControl
              title="💡 Luz da Garagem"
              status={garagemDevices.luzGaragem.status}
              loading={garagemDevices.luzGaragem.loading}
              onCommand={(cmd) => sendMQTTCommand("casa/garagem/luz", cmd, setGaragemDevices, "luzGaragem")}
            />
          </div>
        </div>

        {/* Sala de Estar */}
        <div className="row mb-4">
          <div className="col-12">
            <h4>🛋️ Sala (DHT22 + Controle Automático)</h4>
          </div>
          <div className="col-md-4 mb-3">
            <DeviceControl
              title="💡 Luz da Sala"
              status={salaDevices.luzSala.status}
              loading={salaDevices.luzSala.loading}
              onCommand={(cmd) => sendMQTTCommand("casa/sala/luz", cmd, setSalaDevices, "luzSala")}
            />
          </div>
          <div className="col-md-4 mb-3">
            <div className="card device-card h-100">
              <div className="card-body text-center">
                <h6 className="card-title">❄️ Ar-condicionado</h6>
                <div
                  className={`badge bg-${salaDevices.arCondicionado.status === "ligado" ? "success" : "secondary"} mb-2`}
                >
                  {salaDevices.arCondicionado.status.charAt(0).toUpperCase() +
                    salaDevices.arCondicionado.status.slice(1)}
                </div>
                <p className="small text-muted">Automático: Liga ≥28°C, Desliga &lt;20°C</p>
              </div>
            </div>
          </div>
          <div className="col-md-4 mb-3">
            <div className="card device-card h-100">
              <div className="card-body text-center">
                <h6 className="card-title">💨 Umidificador</h6>
                <div
                  className={`badge bg-${salaDevices.umidificador.status === "ligado" ? "success" : "secondary"} mb-2`}
                >
                  {salaDevices.umidificador.status.charAt(0).toUpperCase() + salaDevices.umidificador.status.slice(1)}
                </div>
                <p className="small text-muted">Automático: Liga ≤20%, Desliga ≥80%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quarto */}
        <div className="row mb-4">
          <div className="col-12">
            <h4>🛏️ Quarto (Motor de Passo)</h4>
          </div>
          <div className="col-md-4 mb-3">
            <DeviceControl
              title="💡 Luz do Quarto"
              status={quartoDevices.luzQuarto.status}
              loading={quartoDevices.luzQuarto.loading}
              onCommand={(cmd) => sendMQTTCommand("casa/quarto/luz", cmd, setQuartoDevices, "luzQuarto")}
            />
          </div>
          <div className="col-md-4 mb-3">
            <DeviceControl
              title="🔌 Tomada Inteligente"
              status={quartoDevices.tomadaInteligente.status}
              loading={quartoDevices.tomadaInteligente.loading}
              onCommand={(cmd) => sendMQTTCommand("casa/quarto/tomada", cmd, setQuartoDevices, "tomadaInteligente")}
            />
          </div>
          <div className="col-md-4 mb-3">
            <DeviceControl
              title="🪟 Cortina (Stepper)"
              status={quartoDevices.cortina.status}
              loading={quartoDevices.cortina.loading}
              type="curtain"
              onCommand={(cmd) => sendMQTTCommand("casa/quarto/cortina", cmd, setQuartoDevices, "cortina")}
            />
          </div>
        </div>

        {/* Log de Mensagens */}
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">📝 Log MQTT em Tempo Real</h5>
              </div>
              <div className="card-body">
                <div className="log-container">
                  {messageLog.length === 0 ? (
                    <p className="text-muted">Aguardando mensagens MQTT...</p>
                  ) : (
                    messageLog.map((log) => (
                      <div
                        key={log.id}
                        className={`mb-1 ${
                          log.type === "error"
                            ? "text-danger"
                            : log.type === "success"
                              ? "text-success"
                              : log.type === "sent"
                                ? "text-primary"
                                : log.type === "received"
                                  ? "text-info"
                                  : ""
                        }`}
                      >
                        <small className="text-muted">[{log.timestamp}]</small> {log.message}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
