// pages/index/index.js
const app = getApp()

Page({
  data: {
    location: null,
    todayForecast: null,
    forecasts: [],
    loading: false,
    error: null
  },

  onLoad() {
    console.log('首页加载')
    this.loadPreferences()
    
    // 尝试获取位置
    this.getLocation()
  },

  onShow() {
    // 页面显示时重新加载偏好设置
    this.loadPreferences()
  },

  // 加载偏好设置
  loadPreferences() {
    const preferences = wx.getStorageSync('preferences') || app.globalData.preferences
    this.setData({
      preferences: preferences
    })
  },

  // 获取位置
  getLocation() {
    wx.showLoading({
      title: '定位中...',
      mask: true
    })

    // 先检查是否已有位置权限
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation']) {
          // 已有权限，直接获取位置
          this.getUserLocation()
        } else {
          // 请求位置权限
          wx.authorize({
            scope: 'scope.userLocation',
            success: () => {
              this.getUserLocation()
            },
            fail: (err) => {
              console.error('位置授权失败:', err)
              this.showDefaultLocation()
            }
          })
        }
      },
      fail: (err) => {
        console.error('获取设置失败:', err)
        this.showDefaultLocation()
      }
    })
  },

  // 获取用户位置
  getUserLocation() {
    wx.getLocation({
      type: 'wgs84',
      altitude: false,
      isHighAccuracy: true,
      highAccuracyExpireTime: 3000,
      success: (res) => {
        // 获取具体地址信息
        this.getAddressFromCoordinates(res.latitude, res.longitude, (address) => {
          const location = {
            lat: res.latitude,
            lon: res.longitude,
            address: address || '当前位置'
          }
          
          this.setData({ location })
          wx.hideLoading()
          
          // 保存位置到全局数据
          const app = getApp()
          app.globalData.location = location
          wx.setStorageSync('location', location)
          
          // 自动获取天气
          this.fetchWeather()
        })
      },
      fail: (err) => {
        console.error('获取位置失败:', err)
        wx.hideLoading()
        
        // 根据错误码提供更详细的提示
        let errorMsg = '获取位置失败'
        if (err.errCode === 2) {
          errorMsg = '位置服务不可用，请检查GPS是否开启'
        } else if (err.errCode === 3) {
          errorMsg = '定位超时，请重试'
        }
        
        wx.showModal({
          title: '定位失败',
          content: errorMsg,
          showCancel: false,
          success: () => {
            this.showDefaultLocation()
          }
        })
      }
    })
  },

  // 根据坐标获取地址信息
  getAddressFromCoordinates(lat, lon, callback) {
    // 使用腾讯地图逆地理编码API获取地址
    const mapApiUrl = `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat},${lon}&key=OB4BZ-D4W3U-B7VVO-4PJWW-6TKDJ-WPB77&output=json`;
    
    wx.request({
      url: mapApiUrl,
      success: (res) => {
        if (res.data.status === 0 && res.data.result) {
          const address = res.data.result.address_component;
          const fullAddress = `${address.province}${address.city}${address.district}${address.street}${address.street_number}`;
          callback(fullAddress);
        } else {
          callback(null);
        }
      },
      fail: () => {
        callback(null);
      }
    });
  },

  // 显示默认位置
  showDefaultLocation() {
    const defaultLocation = {
      lat: 22.5229,
      lon: 114.0545,
      address: '香港（默认）'
    }
    
    this.setData({ location: defaultLocation })
    wx.hideLoading()
    
    wx.showModal({
      title: '位置授权',
      content: '为了获取准确的天气数据，请授权位置权限',
      confirmText: '去设置',
      cancelText: '使用默认',
      success: (res) => {
        if (res.confirm) {
          wx.openSetting()
        }
      }
    })
  },

  // 获取天气数据
  async fetchWeather() {
    if (!this.data.location) {
      wx.showToast({
        title: '请先获取位置',
        icon: 'none'
      })
      return
    }

    this.setData({
      loading: true,
      error: null
    })

    try {
      const weatherData = await app.fetchWeather(
        this.data.location.lat,
        this.data.location.lon
      )

      if (!weatherData) {
        throw new Error('获取天气数据失败')
      }

      const forecasts = app.processForecast(
        weatherData,
        this.data.preferences.workStart,
        this.data.preferences.workEnd,
        this.data.preferences.preference
      )

      // 处理今日数据
      const todayForecast = forecasts[0]
      if (todayForecast) {
        const date = new Date(todayForecast.date)
        const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
        todayForecast.dateDisplay = `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`
      }

      this.setData({
        todayForecast,
        forecasts,
        loading: false
      })

      // 调试信息：检查数据是否正确设置
      console.log('📊 今日天气预报数据:', todayForecast)
      console.log('📊 所有预报数据:', forecasts)
      
      // 检查页面数据状态
      console.log('📱 页面数据状态:', {
        hasTodayForecast: !!todayForecast,
        todayForecastKeys: todayForecast ? Object.keys(todayForecast) : [],
        forecastsCount: forecasts.length,
        // 检查关键属性是否存在
        hasAvgTemp: todayForecast && todayForecast.avg_temp !== undefined,
        hasAvgHumidity: todayForecast && todayForecast.avg_humidity !== undefined,
        hasAvgWind: todayForecast && todayForecast.avg_wind !== undefined,
        hasRainProb: todayForecast && todayForecast.rain_probability !== undefined,
        // 检查数值范围
        avgTempValue: todayForecast ? todayForecast.avg_temp : 'N/A',
        avgHumidityValue: todayForecast ? todayForecast.avg_humidity : 'N/A',
        avgWindValue: todayForecast ? todayForecast.avg_wind : 'N/A'
      })

      wx.showToast({
        title: '天气数据更新成功',
        icon: 'success'
      })

    } catch (error) {
      console.error('获取天气失败:', error)
      this.setData({
        error: error.message || '获取天气数据失败',
        loading: false
      })
      
      wx.showToast({
        title: '获取天气失败',
        icon: 'error'
      })
    }
  },

  // 重试获取
  retryFetch() {
    this.setData({ error: null })
    this.fetchWeather()
  },

  // 跳转到预报页面
  goToForecast() {
    if (this.data.forecasts.length === 0) {
      wx.showToast({
        title: '请先获取天气数据',
        icon: 'none'
      })
      return
    }

    wx.navigateTo({
      url: '/pages/forecast/forecast?forecasts=' + encodeURIComponent(JSON.stringify(this.data.forecasts))
    })
  },

  // 跳转到设置页面
  goToSettings() {
    wx.navigateTo({
      url: '/pages/settings/settings'
    })
  },

  // 分享功能
  onShareAppMessage() {
    return {
      title: '晾衣助手 - 智能天气晾衣建议',
      path: '/pages/index/index',
      imageUrl: '/images/share.png'
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: '晾衣助手 - 智能天气晾衣建议',
      imageUrl: '/images/share.png'
    }
  }
})