// pages/forecast/forecast.js
Page({
  data: {
    forecasts: [],
    currentForecast: null
  },

  onLoad(options) {
    console.log('预报页面加载', options)
    
    if (options.forecasts) {
      const forecasts = JSON.parse(decodeURIComponent(options.forecasts))
      this.processForecasts(forecasts)
    }
  },

  // 处理预报数据
  processForecasts(forecasts) {
    const processedForecasts = forecasts.map(forecast => {
      const date = new Date(forecast.date)
      const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
      const weekday = weekdays[date.getDay()]
      
      let dateDisplay = `${date.getMonth() + 1}月${date.getDate()}日 ${weekday}`
      if (this.isToday(date)) {
        dateDisplay += '（今天）'
      } else if (this.isTomorrow(date)) {
        dateDisplay += '（明天）'
      }
      
      return {
        ...forecast,
        dateDisplay
      }
    })

    this.setData({
      forecasts: processedForecasts,
      currentForecast: processedForecasts[0]
    })
  },

  // 显示预报详情
  showForecastDetail(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      currentForecast: this.data.forecasts[index]
    })
  },

  // 工具函数：判断是否为今天
  isToday(date) {
    const today = new Date()
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear()
  },

  // 工具函数：判断是否为明天
  isTomorrow(date) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return date.getDate() === tomorrow.getDate() &&
           date.getMonth() === tomorrow.getMonth() &&
           date.getFullYear() === tomorrow.getFullYear()
  },

  // 获取工作时间温度范围
  getWorkHourTempRange(workHourData) {
    const temps = workHourData.map(h => h.temperature_2m).filter(t => t !== null && t !== undefined)
    if (temps.length === 0) return 'N/A'
    return `${Math.min(...temps).toFixed(1)}-${Math.max(...temps).toFixed(1)}`
  },

  // 获取工作时间湿度范围
  getWorkHourHumidityRange(workHourData) {
    const humidity = workHourData.map(h => h.relative_humidity_2m).filter(h => h !== null && h !== undefined)
    if (humidity.length === 0) return 'N/A'
    return `${Math.min(...humidity).toFixed(0)}-${Math.max(...humidity).toFixed(0)}`
  },

  // 获取最大降雨概率
  getMaxRainProb(workHourData) {
    const rain = workHourData.map(h => h.precipitation_probability).filter(r => r !== null && r !== undefined)
    if (rain.length === 0) return 0
    return Math.max(...rain).toFixed(0)
  },

  // 导出报告
  exportReport() {
    if (this.data.forecasts.length === 0) {
      wx.showToast({
        title: '没有数据可导出',
        icon: 'none'
      })
      return
    }

    let report = `晾衣助手 - 5天天气预报摘要\n${'='.repeat(40)}\n\n`
    report += `生成时间：${new Date().toLocaleString()}\n\n`

    this.data.forecasts.forEach(forecast => {
      report += `${forecast.dateDisplay}\n`
      report += `  晾衣指数：${forecast.drying_index.toFixed(0)}/100\n`
      report += `  建议：${forecast.recommendation}\n`
      report += `  温度：${forecast.min_temp.toFixed(0)}°C - ${forecast.max_temp.toFixed(0)}°C\n`
      report += `  湿度：${forecast.avg_humidity.toFixed(0)}%\n`
      report += `  降雨概率：${forecast.rain_probability.toFixed(0)}%\n`
      if (forecast.rain_alert) {
        report += `  ⚠️ 工作时段有雨风险\n`
      }
      report += '\n'
    })

    // 在小程序中，我们可以显示分享菜单或保存到文件
    wx.showModal({
      title: '导出报告',
      content: report,
      showCancel: false,
      confirmText: '复制内容'
    })
  },

  // 返回首页
  goBack() {
    wx.navigateBack()
  },

  // 分享功能
  onShareAppMessage() {
    return {
      title: '晾衣助手 - 5天天气预报',
      path: '/pages/forecast/forecast'
    }
  }
})